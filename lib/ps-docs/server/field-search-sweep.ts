import { sessionErrorMessage } from "@/lib/ps-docs/api-helpers";
import { EMPTY_CATALOGS, type ActionCatalogs } from "@/lib/ps-docs/parse-structure";
import { collectContainerReferences, type ProcessSearchSource } from "@/lib/ps-docs/field-search";
import type { StandaloneContainer, SweepEvent } from "@/lib/ps-docs/field-search-stream";
import type { DocumentacaoPS, EncaminhamentoSpec } from "@/lib/ps-docs/types";
import { loadProcessStages, loadStage, toActionCatalogs, type ActionCatalogEntries } from "./process-structure";
import { listActivePortals, listPortalProcesses, loadPortalOverview } from "./portal-structure";
import { listContainerCatalog, loadPage, loadPopup } from "./containers";
import type { RubeusClient } from "./rubeus-client";

/** The whole "Buscar elementos" read, server-side, in one request: every process (etapas in
 *  parallel), portal overview and page/pop-up of the chosen scope, streamed back as soon as each
 *  piece is ready. All requests share one `RubeusClient`, so the environment-wide catalogs are
 *  downloaded once and the number of requests in flight stays bounded. The search itself still
 *  runs on the client (`lib/ps-docs/field-search.ts`), so a new term reuses what was read. */

export type SweepInput =
  | { docMode: "processo"; idPs: string; crmDomain?: string }
  | { docMode: "portal"; idPortal: string; localId?: string; crmDomain?: string }
  | { docMode: "ambiente" };

export interface SweepStats {
  portais: number;
  processos: number;
  etapas: number;
  paginasPopups: number;
}

const errorText = (error: unknown) => sessionErrorMessage(error) ?? (error as Error).message;
const isAbort = (error: unknown) => (error as Error)?.name === "AbortError" || (error as Error)?.name === "CanceledError";

export async function runFieldSearchSweep(client: RubeusClient, input: SweepInput, emit: (event: SweepEvent) => void): Promise<SweepStats> {
  const crmDomain = "crmDomain" in input ? input.crmDomain?.trim() || undefined : undefined;
  const fieldCatalog = new Map<number, string>();
  let actionCatalogEntries: ActionCatalogEntries | undefined;
  const sources: ProcessSearchSource[] = [];
  const stats: SweepStats = { portais: 0, processos: 0, etapas: 0, paginasPopups: 0 };

  // Etapa progress summed over every process being read.
  let etapasDone = 0;
  let etapasTotal = 0;
  const progress = () => {
    const where = stats.portais > 1 ? `${stats.processos} processo(s) de ${stats.portais} portal(is)` : stats.processos > 1 ? `${stats.processos} processo(s)` : "";
    emit({ type: "progress", label: where ? `etapa(s) lida(s) em ${where}` : "etapa(s) lida(s)", done: etapasDone, total: etapasTotal });
  };

  /** One process: its etapas in parallel, then the pages its buttons open attached in place (so
   *  their hits keep the etapa/passo context). Emits the source once complete. */
  const loadProcess = async (idPs: string, portal: string, processo: (doc: DocumentacaoPS) => string, warnPrefix: string): Promise<void> => {
    const listed = await loadProcessStages(client, idPs, crmDomain);
    for (const [id, label] of listed.fieldCatalog) if (!fieldCatalog.has(id)) fieldCatalog.set(id, label);
    actionCatalogEntries ??= listed.actionCatalogEntries;
    const catalogs = toActionCatalogs(listed.actionCatalogEntries);
    const warnings = [...listed.catalogWarnings];
    etapasTotal += listed.stages.length;
    progress();

    const etapas = await Promise.all(
      listed.stages.map(async (stage) => {
        try {
          const { etapa, warnings: stageWarnings } = await loadStage(client, idPs, stage.ref, listed.fieldCatalog, catalogs);
          warnings.push(...stageWarnings);
          return etapa;
        } catch (error) {
          if (isAbort(error)) throw error;
          warnings.push(`Etapa "${stage.label}": ${errorText(error)}`);
          return undefined;
        } finally {
          etapasDone++;
          progress();
        }
      })
    );
    const doc: DocumentacaoPS = { tituloPortal: listed.tituloPortal, idPs: listed.idPs, etapas: etapas.filter((e) => e !== undefined) };
    stats.etapas += doc.etapas.length;

    const pageEncs: EncaminhamentoSpec[] = collectContainerReferences(doc).pages;
    const pageIds = [...new Set(pageEncs.map((enc) => enc.paginaId!))];
    const pages = new Map(await Promise.all(pageIds.map(async (id) => [id, await loadPage(client, id, listed.fieldCatalog, catalogs, warnings)] as const)));
    for (const enc of pageEncs) enc.paginaDetalhe = pages.get(enc.paginaId!);

    const source = { portal, processo: processo(doc), doc };
    sources.push(source);
    emit({ type: "source", source });
    if (warnings.length > 0) emit({ type: "warning", messages: warnings.map((w) => `${warnPrefix}${w}`) });
  };

  /** One portal: its overview and every active process; returns the portal's label. Throws when
   *  its process list fails. */
  const loadPortal = async (idPortal: string, localId: number, knownName?: string): Promise<string> => {
    const [overviewRes, listed] = await Promise.all([
      loadPortalOverview(client, idPortal, localId).then(
        (spec) => ({ spec, error: undefined }),
        (error) => {
          if (isAbort(error)) throw error;
          return { spec: undefined, error: errorText(error) };
        }
      ),
      listPortalProcesses(client, idPortal),
    ]);
    const nome = overviewRes.spec?.geral.nome || knownName;
    const portal = nome ? `${idPortal} | ${nome}` : `Portal ${idPortal}`;
    const prefix = input.docMode === "ambiente" ? `${portal}: ` : "";
    if (overviewRes.spec) {
      emit({ type: "overview", portal, spec: overviewRes.spec });
      if (overviewRes.spec.warnings.length > 0) emit({ type: "warning", messages: overviewRes.spec.warnings.map((w) => `${prefix}${w}`) });
    } else {
      emit({ type: "warning", messages: [`${prefix}Dados gerais do portal: ${overviewRes.error}`] });
    }

    stats.processos += listed.processes.length;
    progress();
    await Promise.all(
      listed.processes.map((ref) =>
        loadProcess(ref.id, portal, () => `${ref.identifier} | ${ref.name}`, `${prefix}${ref.name}: `).catch((error) => {
          if (isAbort(error)) throw error;
          emit({ type: "warning", messages: [`${prefix}Processo ${ref.identifier} | ${ref.name}: ${errorText(error)}`] });
        })
      )
    );
    return portal;
  };

  let portalLabel = "—";
  if (input.docMode === "processo") {
    stats.processos = 1;
    progress();
    await loadProcess(input.idPs.trim(), "—", (doc) => `${doc.idPs} | ${doc.tituloPortal}`, "");
  } else if (input.docMode === "portal") {
    stats.portais = 1;
    portalLabel = await loadPortal(input.idPortal.trim(), Number(input.localId?.trim() || "2") || 2);
  } else {
    emit({ type: "progress", label: "lendo a lista de portais", done: 0, total: 0 });
    const { portals, warning } = await listActivePortals(client);
    if (warning) emit({ type: "warning", messages: [warning] });
    if (portals.length === 0) emit({ type: "warning", messages: ["Nenhum portal ativo encontrado — a busca cobriu só as páginas e pop-ups do ambiente."] });
    stats.portais = portals.length;
    await Promise.all(
      portals.map(([id, name]) =>
        loadPortal(String(id), 2, name || undefined).catch((error) => {
          if (isAbort(error)) throw error;
          emit({ type: "warning", messages: [`Portal ${id}${name ? ` | ${name}` : ""}: ${errorText(error)}`] });
        })
      )
    );
  }

  // Portal/ambiente: every other page/pop-up of the environment is searched standalone.
  if (input.docMode !== "processo") {
    const referencedPages = new Set<number>();
    const referencedPopups = new Set<number>();
    for (const s of sources) {
      const refs = collectContainerReferences(s.doc);
      for (const enc of refs.pages) referencedPages.add(enc.paginaId!);
      for (const id of refs.popupIds) referencedPopups.add(id);
    }
    const catalog = await listContainerCatalog(client);
    if (catalog.warnings.length > 0) emit({ type: "warning", messages: catalog.warnings });
    const jobs = [
      ...catalog.pages.filter(([id]) => !referencedPages.has(id)).map(([id]) => ({ kind: "page" as const, id })),
      ...catalog.popups.filter(([id]) => !referencedPopups.has(id)).map(([id]) => ({ kind: "popup" as const, id })),
    ];
    const catalogs: ActionCatalogs = actionCatalogEntries ? toActionCatalogs(actionCatalogEntries) : EMPTY_CATALOGS;
    let done = 0;
    emit({ type: "progress", label: "página(s)/pop-up(s) lido(s)", done, total: jobs.length });
    await Promise.all(
      jobs.map(async (job) => {
        const warnings: string[] = [];
        const container: StandaloneContainer | undefined =
          job.kind === "page"
            ? await loadPage(client, job.id, fieldCatalog, catalogs, warnings).then((spec) => spec && { kind: "page" as const, spec })
            : await loadPopup(client, job.id, fieldCatalog, catalogs, warnings).then((spec) => spec && { kind: "popup" as const, spec });
        if (container) emit({ type: "standalone", containers: [container] });
        if (warnings.length > 0) emit({ type: "warning", messages: warnings });
        emit({ type: "progress", label: "página(s)/pop-up(s) lido(s)", done: ++done, total: jobs.length });
      })
    );
    stats.paginasPopups = done;
  }

  emit({ type: "done", portal: portalLabel, fieldCatalogEntries: [...fieldCatalog.entries()], actionCatalogEntries });
  return stats;
}
