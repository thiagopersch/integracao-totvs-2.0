import { unwrapData, asArray } from "@/lib/ps-docs/api-helpers";
import {
  buildFieldCatalog,
  buildIdTitleCatalog,
  buildStringKeyedCatalog,
  collectPopupReferences,
  harvestFieldLabels,
  parseEtapa,
  parsePopup,
  extractTituloPortal,
  type ActionCatalogs,
  type StageRef,
} from "@/lib/ps-docs/parse-structure";
import type { EtapaSpec } from "@/lib/ps-docs/types";
import { httpError, type RubeusClient } from "./rubeus-client";

/** HTTP + parse core of one processo seletivo, shared by the "Gerar documentação" Server Actions
 *  (`actions/integrations/ps-docs.ts`, which add the permission check and logging) and the
 *  "Buscar elementos" sweep (`./field-search-sweep.ts`). See `ps-docs.ts` for the confirmed API
 *  contract. Every request goes through the given `RubeusClient`, so a sweep over many processes
 *  downloads each environment-wide catalog only once. */

export const ADMIN_API = "https://admin.portal.apprbs.com.br/api";
const BASE_URL = `${ADMIN_API}/selective-process`;

/** `GET /api/settings/fields` returns a field catalog scoped to the calling token's OWN
 *  institution — see the long-form comment in `actions/integrations/ps-docs.ts`. It needs these
 *  browser-like headers (Referer + no-cache), not just the session cookies. */
export function settingsFieldsHeaders(): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Priority: "u=1, i",
    Referer: "https://admin.portal.apprbs.com.br/administrativo/definicoes",
    Origin: "https://admin.portal.apprbs.com.br",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Sec-Ch-Ua": '"Not=A?Brand";v="99", "Google Chrome";v="131", "Chromium";v="131"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
}

export interface StageListItem {
  ref: StageRef;
  label: string;
}

/** Serializable form of `ActionCatalogs` (a Server Action can't return `Map`s across the RSC
 *  boundary) — rebuilt back into `Map`s by whoever consumes it, mirroring `fieldCatalogEntries`. */
export interface ActionCatalogEntries {
  actionTypes: [number, string][];
  dataServerTypes: [number, string][];
  processTypes: [number, string][];
  popups: [number, string][];
  pages: [number, string][];
  rubeusEvents: [string, string][];
  personTypes: [string, string][];
}

export function toActionCatalogs(entries: ActionCatalogEntries): ActionCatalogs {
  return {
    actionTypes: new Map(entries.actionTypes),
    dataServerTypes: new Map(entries.dataServerTypes),
    processTypes: new Map(entries.processTypes),
    popups: new Map(entries.popups),
    pages: new Map(entries.pages),
    rubeusEvents: new Map(entries.rubeusEvents),
    personTypes: new Map(entries.personTypes),
  };
}

export interface ProcessStages {
  idPs: string;
  tituloPortal: string;
  stages: StageListItem[];
  totalStages: number;
  fieldCatalog: Map<number, string>;
  actionCatalogEntries: ActionCatalogEntries;
  catalogWarnings: string[];
}

/** Step 1: the process title, its ACTIVE stages, the field catalog and the id->name catalogs used
 *  to describe button actions/encaminhamentos. Throws (with an HTTP status) when the process
 *  itself can't be read. */
export async function loadProcessStages(client: RubeusClient, idPs: string, crmDomain?: string): Promise<ProcessStages> {
  const [processRes, stageListRes, standardFieldsRes, settingsFieldsRes, actionTypesRes, dataServerTypesRes, processTypesRes, popupsRes, pagesRes, rubeusEventsRes, personTypesRes] = await Promise.all([
    client.get(`${BASE_URL}/opening-page-process/${idPs}`),
    client.get(`${BASE_URL}/opening-page-stages/${idPs}`),
    client.post(`${BASE_URL}/standard-fields`, null, { timeout: 60_000 }),
    // Every field known to the app, keyed by id — last-resort fallback for `fieldCatalog` (see below).
    client.get(`${ADMIN_API}/settings/fields`, { headers: settingsFieldsHeaders() }),
    client.get(`${BASE_URL}/list-totvs-action-types`),
    client.get(`${BASE_URL}/list-data-server-types`),
    client.get(`${BASE_URL}/list-process-types`),
    client.get(`${ADMIN_API}/popups`),
    client.get(`${ADMIN_API}/pages`),
    crmDomain ? client.post(`${BASE_URL}/list-rubeus-events`, { crm_domain: crmDomain }) : Promise.resolve({ status: 204, data: undefined }),
    client.get(`${ADMIN_API}/crm/person-types`),
  ]);

  if (processRes.status >= 400) throw httpError(processRes.status, "opening-page-process");
  if (stageListRes.status >= 400) throw httpError(stageListRes.status, "opening-page-stages");
  if (standardFieldsRes.status >= 400) throw httpError(standardFieldsRes.status, "standard-fields");

  const allStages = asArray(unwrapData(stageListRes.data));
  const stages: StageListItem[] = allStages
    .filter((s) => s.status === 1)
    .map((s) => ({
      ref: {
        list: s,
        name: (s.title as string) ?? "(etapa sem nome)",
        ativa: true,
        steps: asArray(s.steps).map((st) => ({ id: Number(st.id), name: (st.name as string) ?? "" })),
        logics: s.logics,
      },
      label: (s.title as string) ?? "(etapa sem nome)",
    }));

  // `standard-fields` first; the stage harvest and `settings/fields` only fill gaps, never overwrite.
  const fieldCatalog = buildFieldCatalog(standardFieldsRes.data);

  // Labels inline in every stage's own `selected-stage` content (inactive stages included — a
  // field defined only there can still be referenced by an active stage). The same request is
  // reused, via the client's dedupe, by `loadStage` for each active stage.
  const stageHarvestResponses = await Promise.all(
    allStages.map((s) => client.post(`${BASE_URL}/selected-stage/${idPs}`, { stage_id: String(s.id), editor: true }).catch(() => undefined))
  );
  for (const res of stageHarvestResponses) {
    if (!res || res.status >= 400) continue;
    for (const [id, label] of harvestFieldLabels(unwrapData(res.data))) {
      if (!fieldCatalog.has(id)) fieldCatalog.set(id, label);
    }
  }
  if (settingsFieldsRes.status < 400) {
    for (const [id, label] of buildFieldCatalog(settingsFieldsRes.data)) {
      if (!fieldCatalog.has(id)) fieldCatalog.set(id, label);
    }
  }

  const catalogWarnings: string[] = [];
  const checkCatalog = (label: string, res: { status: number }) => {
    if (res.status >= 400) catalogWarnings.push(`Catálogo "${label}" indisponível (HTTP ${res.status}) — os itens correspondentes podem aparecer como "#id" em vez do nome.`);
  };
  checkCatalog("Campos do app (settings/fields)", settingsFieldsRes);
  checkCatalog("Tipos de ação TOTVS", actionTypesRes);
  checkCatalog("Tipos de dataserver", dataServerTypesRes);
  checkCatalog("Tipos de processo", processTypesRes);
  checkCatalog("Pop-ups", popupsRes);
  checkCatalog("Páginas", pagesRes);
  if (!crmDomain) catalogWarnings.push('Catálogo "Eventos Rubeus" não consultado — informe o Link do CRM para resolver o nome dos eventos.');
  else checkCatalog("Eventos Rubeus", rubeusEventsRes);
  checkCatalog("Tipos de pessoa vinculada", personTypesRes);

  const ok = (res: { status: number; data: unknown }) => (res.status < 400 ? res.data : undefined);
  const actionCatalogEntries: ActionCatalogEntries = {
    actionTypes: [...buildIdTitleCatalog(ok(actionTypesRes)).entries()],
    dataServerTypes: [...buildIdTitleCatalog(ok(dataServerTypesRes)).entries()],
    processTypes: [...buildIdTitleCatalog(ok(processTypesRes)).entries()],
    popups: [...buildIdTitleCatalog(ok(popupsRes)).entries()],
    pages: [...buildIdTitleCatalog(ok(pagesRes)).entries()],
    rubeusEvents: [...buildStringKeyedCatalog(ok(rubeusEventsRes)).entries()],
    personTypes: [...buildStringKeyedCatalog(ok(personTypesRes)).entries()],
  };

  return { idPs, tituloPortal: extractTituloPortal(processRes.data, idPs), stages, totalStages: allStages.length, fieldCatalog, actionCatalogEntries, catalogWarnings };
}

/** Step 2: fetches and parses ONE active stage, with the pop-ups its buttons open attached in
 *  place (`enc.popupDetalhe`). Throws when `selected-stage` itself fails. */
export async function loadStage(client: RubeusClient, idPs: string, stage: StageRef, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): Promise<{ etapa: EtapaSpec; warnings: string[] }> {
  const stageId = String(stage.list.id);
  const [selectedStageRes, feedbackRes, stageQueryRes, stepQueryResults] = await Promise.all([
    client.post(`${BASE_URL}/selected-stage/${idPs}`, { stage_id: stageId, editor: true }),
    client.post(`${BASE_URL}/feedback`, { stage_id: stageId, editor: true }),
    // Best effort: a failure just means "Não há sentença SQL configurada".
    client.get(`${BASE_URL}/get-stage-querys/${stageId}`).catch(() => undefined),
    Promise.all(
      stage.steps.map((st) =>
        client
          .get(`${ADMIN_API}/step/querys/${st.id}`)
          .then((res) => ({ stepId: st.id, res }))
          .catch(() => ({ stepId: st.id, res: undefined }))
      )
    ),
  ]);

  if (selectedStageRes.status >= 400) throw httpError(selectedStageRes.status, "selected-stage");

  const stepQueries: Record<number, unknown> = {};
  for (const { stepId, res } of stepQueryResults) {
    if (res && res.status < 400) stepQueries[stepId] = res.data;
  }

  const { etapa, warnings } = parseEtapa(
    stage,
    {
      list: stage.list,
      selectedStage: selectedStageRes.data,
      feedback: feedbackRes.status < 400 ? feedbackRes.data : undefined,
      stageQuery: stageQueryRes && stageQueryRes.status < 400 ? stageQueryRes.data : undefined,
      stepQueries,
    },
    fieldCatalog,
    catalogs
  );

  // Each distinct pop-up opened from this etapa, with its own SQL query — best effort.
  const popupTargets = collectPopupReferences(etapa);
  const uniquePopupIds = [...new Set(popupTargets.map((enc) => enc.popupId!))];
  if (uniquePopupIds.length > 0) {
    const popupResults = await Promise.all(
      uniquePopupIds.map((id) =>
        Promise.all([client.get(`${ADMIN_API}/popups/${id}`).catch(() => undefined), client.get(`${ADMIN_API}/popups/querys/${id}`).catch(() => undefined)]).then(([res, queryRes]) => ({ id, res, queryRes }))
      )
    );
    const popupById = new Map(
      popupResults
        .filter(({ res }) => res && res.status < 400)
        .map(({ id, res, queryRes }) => [id, parsePopup(res!.data, queryRes && queryRes.status < 400 ? queryRes.data : undefined, fieldCatalog, catalogs)])
    );
    for (const enc of popupTargets) if (enc.popupId) enc.popupDetalhe = popupById.get(enc.popupId);
  }

  return { etapa, warnings };
}
