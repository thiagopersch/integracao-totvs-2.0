import { buildIdTitleCatalog, harvestFieldLabels, parsePage, parsePopup, type ActionCatalogs } from "@/lib/ps-docs/parse-structure";
import type { ItemSpec, PaginaSpec, PopupSpec } from "@/lib/ps-docs/types";
import { ADMIN_API } from "./process-structure";
import { type RubeusClient } from "./rubeus-client";

/** Pages and pop-ups for "Buscar elementos" — the parts the process/portal readers don't fetch:
 *  - `GET /api/pages/{id}`  -> a page's own content (same `content[]` shape as a pop-up)
 *  - `GET /api/popups/{id}` -> pop-ups not reached from any etapa
 *  - `GET /api/pages` / `GET /api/popups` -> the `{id, name}` catalogs of the environment */

export async function listContainerCatalog(client: RubeusClient): Promise<{ popups: [number, string][]; pages: [number, string][]; warnings: string[] }> {
  const [popupsRes, pagesRes] = await Promise.all([client.get(`${ADMIN_API}/popups`), client.get(`${ADMIN_API}/pages`)]);
  const warnings: string[] = [];
  for (const [label, res] of [["Pop-ups", popupsRes], ["Páginas", pagesRes]] as const) {
    if (res.status >= 400) warnings.push(`Catálogo de ${label.toLowerCase()}: HTTP ${res.status}`);
  }
  return {
    popups: popupsRes.status < 400 ? [...buildIdTitleCatalog(popupsRes.data).entries()] : [],
    pages: pagesRes.status < 400 ? [...buildIdTitleCatalog(pagesRes.data).entries()] : [],
    warnings,
  };
}

/** Labels harvested from the payload itself fill the gaps of the base catalog, never overwriting
 *  it — same enrichment as `parseEtapa`. */
function catalogFor(raw: unknown, baseCatalog: Map<number, string>) {
  const harvested = harvestFieldLabels(raw);
  return harvested.size > 0 ? new Map([...harvested, ...baseCatalog]) : baseCatalog;
}

async function fetchRaw(client: RubeusClient, kind: "popups" | "pages", id: number, warnings: string[]): Promise<unknown | undefined> {
  const label = kind === "popups" ? "Pop-up" : "Página";
  try {
    const res = await client.get(`${ADMIN_API}/${kind}/${id}`);
    if (res.status >= 400) {
      warnings.push(`${label} #${id}: HTTP ${res.status}`);
      return undefined;
    }
    return res.data;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    warnings.push(`${label} #${id}: ${(error as Error).message}`);
    return undefined;
  }
}

export async function loadPopup(client: RubeusClient, id: number, baseCatalog: Map<number, string>, catalogs: ActionCatalogs, warnings: string[]): Promise<PopupSpec | undefined> {
  const raw = await fetchRaw(client, "popups", id, warnings);
  return raw === undefined ? undefined : parsePopup(raw, undefined, catalogFor(raw, baseCatalog), catalogs);
}

/** A page with the pop-ups opened from its own buttons attached as `popupDetalhe`, mirroring
 *  what `loadStage` does for an etapa. Best effort: a failed one becomes a warning. */
export async function loadPage(client: RubeusClient, id: number, baseCatalog: Map<number, string>, catalogs: ActionCatalogs, warnings: string[]): Promise<PaginaSpec | undefined> {
  const raw = await fetchRaw(client, "pages", id, warnings);
  if (raw === undefined) return undefined;
  const page = parsePage(raw, catalogFor(raw, baseCatalog), catalogs);
  if (page.itens.length === 0) warnings.push(`Página "${page.nome}" (#${id}) não retornou componentes — formato da resposta não reconhecido ou página vazia.`);

  const nested: { popupId?: number; popupDetalhe?: PopupSpec }[] = [];
  const visit = (itens: ItemSpec[]) => {
    for (const item of itens) {
      for (const enc of item.encaminhamentos ?? []) if (enc.popupId) nested.push(enc);
      if (item.filhos) visit(item.filhos);
    }
  };
  visit(page.itens);
  const popupIds = [...new Set(nested.map((enc) => enc.popupId!))];
  const popups = new Map(await Promise.all(popupIds.map(async (popupId) => [popupId, await loadPopup(client, popupId, baseCatalog, catalogs, warnings)] as const)));
  for (const enc of nested) enc.popupDetalhe = popups.get(enc.popupId!);
  return page;
}
