"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { authHeaders, unwrapData, asArray, logApiCall, logAndNotifyFailure, type Raw } from "@/lib/ps-docs/api-helpers";
import {
  buildFieldCatalog,
  buildIdTitleCatalog,
  buildStringKeyedCatalog,
  collectPopupReferences,
  harvestFieldLabels,
  parseEtapa,
  parsePopup,
  extractTituloPortal,
  EMPTY_CATALOGS,
  type ActionCatalogs,
  type StageRef,
} from "@/lib/ps-docs/parse-structure";
import type { EtapaSpec } from "@/lib/ps-docs/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Rubeus "processo seletivo" builder API. Contract confirmed live (idPs 5537 and 17869) against
 * the requests the admin SPA itself makes when opening
 * `admin.portal.apprbs.com.br/administrativo/processo-seletivo/etapa/{idPs}-{idEtapa}`:
 *  - `GET  /opening-page-process/{idPs}`                            -> process title/settings
 *  - `GET  /opening-page-stages/{idPs}`                             -> list of ALL stages ("etapas")
 *    for the process (note: the `{idPs}-{idEtapa}` suffixed variant returns the exact same list —
 *    it does NOT scope to one stage, despite what the URL implies)
 *  - `POST /standard-fields` (no body)                              -> global `field_id -> label`
 *    catalog, fetched once for the whole process
 *  - `POST /selected-stage/{idPs}` body `{ stage_id, editor: true }` -> that stage's steps, each
 *    with the real field/component `content` array (a button's `button_actions`/`forwardData`
 *    live inline on its content item here)
 *  - `POST /feedback` body `{ stage_id, editor: true }` (no idPs in the URL) -> that stage's feedbacks
 *
 * Split into `listSelectiveProcessStages` + `fetchStageDocumentation` (one call per stage) rather
 * than a single monolithic action, so the page can render each etapa as soon as it arrives instead
 * of waiting for the whole process.
 */
const BASE_URL = "https://admin.portal.apprbs.com.br/api/selective-process";

/** `GET /api/settings/fields` returns a field catalog scoped to the calling token's OWN
 *  institution (its JWT `baseInstituicao` claim) — confirmed live: called with a token from an
 *  institution other than the one that owns the `idPs` being documented, it consistently returns
 *  that OTHER institution's catalog (same shape, different ids/labels entirely — e.g. 764 fields
 *  with none of the target process's custom fields) regardless of headers, cache-busting, or a
 *  matching `branch`+`inscricoes_session`+`client_id` cookie. Not fixable from the request we
 *  send — the token itself has to belong to the right institution. When it does, this endpoint's
 *  catalog is confirmed IDENTICAL to `standard-fields`' (no label ever disagreed, live-tested).
 *  Given that, and per explicit instruction, it's now used as a third, LAST-RESORT fallback for
 *  `fieldCatalog` (see call site) — after `standard-fields` and the per-stage harvest, both of
 *  which are checked first and never overwritten by it. Worst case (wrong-institution token): it
 *  simply contributes nothing new, same as before this fallback existed. Best case (right
 *  institution, `standard-fields` just missing an id `settings/fields` happens to have): it
 *  closes a residual gap that would otherwise render as "campo #id". */
function settingsFieldsHeaders(tokenPs: string) {
  return {
    ...authHeaders(tokenPs),
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

/** `list-rubeus-events` needs a `crm_domain` body param the admin SPA builds from the logged-in
 *  tenant (e.g. `https://crmtoledo.apprubeus.com.br/`) — pulled from the token's own
 *  `nomeInstituicao` claim (decoded, not verified: this only reads a claim off the user's own
 *  token to shape one outgoing request, never used for auth). Returns `undefined` if the token
 *  isn't a well-formed JWT or doesn't carry that claim, in which case the events catalog is just
 *  skipped rather than blocking the rest of the document. */
function crmDomainFromToken(tokenPs: string): string | undefined {
  try {
    const payload = tokenPs.split(".")[1];
    if (!payload) return undefined;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    const claims = JSON.parse(json) as Raw;
    const nomeInstituicao = typeof claims.nomeInstituicao === "string" ? claims.nomeInstituicao : undefined;
    return nomeInstituicao ? `https://crm${nomeInstituicao}.apprubeus.com.br/` : undefined;
  } catch {
    return undefined;
  }
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

function toActionCatalogs(entries: ActionCatalogEntries): ActionCatalogs {
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

export interface ListStagesResult {
  success: boolean;
  error?: string;
  idPs?: string;
  tituloPortal?: string;
  stages?: StageListItem[];
  fieldCatalogEntries?: [number, string][];
  actionCatalogEntries?: ActionCatalogEntries;
  catalogWarnings?: string[];
}

/** Step 1: resolves the process title, the list of ACTIVE stages, the global field catalog
 *  (needed to resolve `field_compare_id`/`field_id_to_save_*` references later), and the small
 *  id->name catalogs needed to describe button actions/encaminhamentos (`list-totvs-action-types`,
 *  `list-data-server-types`, `list-process-types`, `popups`, `pages` — all confirmed live, each a
 *  small one-shot `{id, title|name}` list, fetched once for the whole process). */
export async function listSelectiveProcessStages(input: { tokenPs: string; idPs: string; crmDomain?: string }): Promise<ListStagesResult> {
  const { organizationId, userId } = await requirePermission("ps_docs", "execute");

  const idPs = input.idPs.trim();
  const tokenPs = input.tokenPs.trim();
  if (!idPs || !tokenPs) return { success: false, error: "Informe o Token PS e o ID PS" };

  const headers = authHeaders(tokenPs);
  const stageListUrl = `${BASE_URL}/opening-page-stages/${idPs}`;
  // Prefer the user-supplied CRM link (most reliable) over the one guessed from the token's own
  // `nomeInstituicao` claim — some tenants' CRM subdomain doesn't match the portal's institution
  // slug exactly, so the guess is only a fallback.
  const crmDomain = input.crmDomain?.trim() || crmDomainFromToken(tokenPs);

  try {
    const [processRes, stageListRes, standardFieldsRes, settingsFieldsRes, actionTypesRes, dataServerTypesRes, processTypesRes, popupsRes, pagesRes, rubeusEventsRes, personTypesRes] = await Promise.all([
      axios.get(`${BASE_URL}/opening-page-process/${idPs}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(stageListUrl, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.post(`${BASE_URL}/standard-fields`, null, { headers, validateStatus: () => true, timeout: 60_000 }),
      // Every field known to the app, keyed by id — confirmed by the user as the source that
      // covers ids `standard-fields` doesn't (e.g. 316191 "IDPS", 316210 "CPF"). Best-effort: a
      // failure here still leaves `standard-fields` results intact, just fewer ids resolved.
      // Needs `settingsFieldsHeaders` (Referer + no-cache), not just the Bearer token — see there.
      axios.get("https://admin.portal.apprbs.com.br/api/settings/fields", { headers: settingsFieldsHeaders(tokenPs), validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${BASE_URL}/list-totvs-action-types`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${BASE_URL}/list-data-server-types`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${BASE_URL}/list-process-types`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get("https://admin.portal.apprbs.com.br/api/popups", { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get("https://admin.portal.apprbs.com.br/api/pages", { headers, validateStatus: () => true, timeout: 30_000 }),
      crmDomain
        ? axios.post(`${BASE_URL}/list-rubeus-events`, { crm_domain: crmDomain }, { headers, validateStatus: () => true, timeout: 30_000 })
        : Promise.resolve({ status: 204, data: undefined }),
      axios.get("https://admin.portal.apprbs.com.br/api/crm/person-types", { headers, validateStatus: () => true, timeout: 30_000 }),
    ]);

    if (processRes.status >= 400) throw Object.assign(new Error(`HTTP ${processRes.status} ao consultar opening-page-process`), { response: { status: processRes.status } });
    if (stageListRes.status >= 400) throw Object.assign(new Error(`HTTP ${stageListRes.status} ao consultar opening-page-stages`), { response: { status: stageListRes.status } });
    if (standardFieldsRes.status >= 400) throw Object.assign(new Error(`HTTP ${standardFieldsRes.status} ao consultar standard-fields`), { response: { status: standardFieldsRes.status } });

    const allStages = asArray(unwrapData(stageListRes.data));
    const activeStages = allStages.filter((s) => s.status === 1);

    const stages: StageListItem[] = activeStages.map((s) => ({
      ref: {
        list: s,
        name: (s.title as string) ?? "(etapa sem nome)",
        ativa: true,
        steps: asArray(s.steps).map((st) => ({ id: Number(st.id), name: (st.name as string) ?? "" })),
        logics: s.logics,
      },
      label: (s.title as string) ?? "(etapa sem nome)",
    }));

    // `standard-fields` is the highest-priority source — confirmed most reliable from a
    // server-to-server call when the token's own institution matches the `idPs` being documented
    // (see the comment on `settingsFieldsHeaders` for the institution-mismatch caveat that applies
    // to this endpoint too, not just `settings/fields`). The two fallback layers below only ever
    // fill gaps this catalog doesn't cover — never overwrite an id already resolved here.
    const fieldCatalog = buildFieldCatalog(standardFieldsRes.data);

    // `standard-fields` only covers a SUBSET of the fields actually used across the process —
    // confirmed live (user report): several system fields referenced by button actions/dataserver
    // columns/display logic (e.g. "Profissão" 288150, "Permite realizar inscrição" 288068) are
    // entirely absent from `standard-fields` but ARE present, with their real label, inline on the
    // field's own record inside `selected-stage`'s `content`/`standard_fields`. Fetched for EVERY
    // stage (not just active ones) since a field can be defined only inside an INACTIVE stage's own
    // content while still being referenced by an active stage's display logic/action. This duplicates
    // the `selected-stage` call `fetchStageDocumentation` makes later for each active stage's own
    // parse — acceptable, since this pass is what makes cross-stage `field_id` references resolve to
    // a name instead of "campo #id". Best-effort per stage: a failed fetch here just means that one
    // stage's fields don't get harvested, never blocks the rest of the document.
    const stageHarvestResponses = await Promise.all(
      allStages.map((s) => axios.post(`${BASE_URL}/selected-stage/${idPs}`, { stage_id: String(s.id), editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }).catch(() => undefined))
    );
    for (const res of stageHarvestResponses) {
      if (!res || res.status >= 400) continue;
      for (const [id, label] of harvestFieldLabels(unwrapData(res.data))) {
        if (!fieldCatalog.has(id)) fieldCatalog.set(id, label);
      }
    }

    // Third and last-resort fallback: `settings/fields` (already fetched below for
    // `settingsFieldsRes`). Per explicit instruction — see the comment on `settingsFieldsHeaders`
    // for why this was excluded before and why it's safe to include now: it only ever fills an id
    // neither `standard-fields` nor the stage harvest above covered, never overwrites either.
    if (settingsFieldsRes.status < 400) {
      for (const [id, label] of buildFieldCatalog(settingsFieldsRes.data)) {
        if (!fieldCatalog.has(id)) fieldCatalog.set(id, label);
      }
    }

    // The remaining catalogs are only used to enrich the "Ações"/"Encaminhamentos" sections —
    // a failed lookup (expired permission on that route, etc.) shouldn't block the whole document,
    // so these are resolved best-effort instead of throwing on a non-2xx status. A failure is
    // silent to the pipeline (the affected section just shows "#id" placeholders) but is now
    // surfaced as a `catalogWarnings` entry so it isn't a silent black box — without a live token
    // in every debugging session, a status code in the warning list is the only way to tell a
    // real failure apart from "the section just has no popups configured".
    const catalogWarnings: string[] = [];
    const checkCatalog = (label: string, res: { status: number }) => {
      if (res.status >= 400) catalogWarnings.push(`Catálogo "${label}" indisponível (HTTP ${res.status}) — os itens correspondentes podem aparecer como "#id" em vez do nome.`);
    };
    // settings/fields is now also used as a fallback source for `fieldCatalog` (see above), so a
    // non-2xx here means that third layer silently contributed nothing — worth flagging.
    checkCatalog("Campos do app (settings/fields)", settingsFieldsRes);
    checkCatalog("Tipos de ação TOTVS", actionTypesRes);
    checkCatalog("Tipos de dataserver", dataServerTypesRes);
    checkCatalog("Tipos de processo", processTypesRes);
    checkCatalog("Pop-ups", popupsRes);
    checkCatalog("Páginas", pagesRes);
    if (!crmDomain) catalogWarnings.push('Catálogo "Eventos Rubeus" não consultado — informe o Link do CRM para resolver o nome dos eventos.');
    else checkCatalog("Eventos Rubeus", rubeusEventsRes);
    checkCatalog("Tipos de pessoa vinculada", personTypesRes);

    const actionCatalogEntries: ActionCatalogEntries = {
      actionTypes: [...buildIdTitleCatalog(actionTypesRes.status < 400 ? actionTypesRes.data : undefined).entries()],
      dataServerTypes: [...buildIdTitleCatalog(dataServerTypesRes.status < 400 ? dataServerTypesRes.data : undefined).entries()],
      processTypes: [...buildIdTitleCatalog(processTypesRes.status < 400 ? processTypesRes.data : undefined).entries()],
      popups: [...buildIdTitleCatalog(popupsRes.status < 400 ? popupsRes.data : undefined).entries()],
      pages: [...buildIdTitleCatalog(pagesRes.status < 400 ? pagesRes.data : undefined).entries()],
      rubeusEvents: [...buildStringKeyedCatalog(rubeusEventsRes.status < 400 ? rubeusEventsRes.data : undefined).entries()],
      personTypes: [...buildStringKeyedCatalog(personTypesRes.status < 400 ? personTypesRes.data : undefined).entries()],
    };

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url: stageListUrl,
      httpMethod: "GET",
      httpStatus: stageListRes.status,
      requestSummary: { idPs } as Prisma.InputJsonValue,
      responseSummary: { etapasAtivas: stages.length, etapasTotal: allStages.length } as Prisma.InputJsonValue,
    });

    return {
      success: true,
      idPs,
      tituloPortal: extractTituloPortal(processRes.data, idPs),
      stages,
      fieldCatalogEntries: [...fieldCatalog.entries()],
      actionCatalogEntries,
      catalogWarnings,
    };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url: stageListUrl, method: "GET", idPs, error });
    return { success: false, error: (error as Error).message };
  }
}

export interface FetchStageResult {
  success: boolean;
  error?: string;
  etapa?: EtapaSpec;
  warnings?: string[];
}

/** Step 2: fetches and parses ONE stage — called once per active stage returned by
 *  `listSelectiveProcessStages`, so the page can append each etapa to the documentation as soon
 *  as it's ready. */
export async function fetchStageDocumentation(input: {
  tokenPs: string;
  idPs: string;
  stage: StageRef;
  fieldCatalogEntries: [number, string][];
  actionCatalogEntries?: ActionCatalogEntries;
}): Promise<FetchStageResult> {
  const { organizationId, userId } = await requirePermission("ps_docs", "execute");

  const idPs = input.idPs.trim();
  const tokenPs = input.tokenPs.trim();
  const stageId = String(input.stage.list.id);
  const headers = authHeaders(tokenPs);
  const url = `${BASE_URL}/selected-stage/${idPs}`;

  try {
    const [selectedStageRes, feedbackRes, stageQueryRes, stepQueryResults] = await Promise.all([
      axios.post(url, { stage_id: stageId, editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.post(`${BASE_URL}/feedback`, { stage_id: stageId, editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }),
      // The stage's own configured SQL query (Coligada/Sistema/Consulta/Cache/Parâmetros) — best
      // effort: a failure here just means the etapa renders "Não há sentença SQL configurada"
      // instead of blocking the rest of the document.
      axios.get(`${BASE_URL}/get-stage-querys/${stageId}`, { headers, validateStatus: () => true, timeout: 30_000 }).catch(() => undefined),
      // Same, but one per step (`GET /api/step/querys/{step_id}`) — same best-effort treatment.
      Promise.all(
        input.stage.steps.map((st) =>
          axios
            .get(`https://admin.portal.apprbs.com.br/api/step/querys/${st.id}`, { headers, validateStatus: () => true, timeout: 30_000 })
            .then((res) => ({ stepId: st.id, res }))
            .catch(() => ({ stepId: st.id, res: undefined }))
        )
      ),
    ]);

    if (selectedStageRes.status >= 400) throw Object.assign(new Error(`HTTP ${selectedStageRes.status} ao consultar selected-stage`), { response: { status: selectedStageRes.status } });

    const stepQueries: Record<number, unknown> = {};
    for (const { stepId, res } of stepQueryResults) {
      if (res && res.status < 400) stepQueries[stepId] = res.data;
    }

    // `fieldCatalog` is built solely from `POST /standard-fields` (the only field-name source
    // confirmed correct) — an earlier version also tried a per-id `GET /api/custom-component/{id}`
    // fallback for ids missing from that catalog, but real tests showed it returning WRONG labels
    // for system-field ids (e.g. field_id 316191 "IDPS" resolving to "Botões") instead of failing
    // loudly, so it was removed. An id `standard-fields` doesn't cover now renders honestly as
    // "campo #<id>" instead of a plausible-looking wrong name — don't reintroduce a per-id lookup
    // without confirming live that it returns the *right* component for that id.
    const fieldCatalog = new Map(input.fieldCatalogEntries);

    const catalogs = input.actionCatalogEntries ? toActionCatalogs(input.actionCatalogEntries) : EMPTY_CATALOGS;

    const { etapa, warnings } = parseEtapa(
      input.stage,
      {
        list: input.stage.list,
        selectedStage: selectedStageRes.data,
        feedback: feedbackRes.status < 400 ? feedbackRes.data : undefined,
        stageQuery: stageQueryRes && stageQueryRes.status < 400 ? stageQueryRes.data : undefined,
        stepQueries,
      },
      fieldCatalog,
      catalogs
    );

    // A button's "Abrir pop-up" encaminhamento only carries the raw `popup_id` until here — fetch
    // each DISTINCT referenced pop-up's own full config (`GET /api/popups/{id}`) and its own
    // configured SQL query (`GET /api/popups/querys/{id}`, confirmed live to share the exact same
    // shape as `step/querys/{step_id}`), and attach the parsed result in place
    // (`enc.popupDetalhe = ...`), per explicit instruction. Best-effort, same as every other
    // per-id fetch in this pipeline: a failed pop-up fetch just leaves that encaminhamento's
    // `popupDetalhe` unset instead of blocking the rest of the document.
    const popupTargets = collectPopupReferences(etapa);
    const uniquePopupIds = [...new Set(popupTargets.map((enc) => enc.popupId!))];
    if (uniquePopupIds.length > 0) {
      const popupResults = await Promise.all(
        uniquePopupIds.map((id) =>
          Promise.all([
            axios.get(`https://admin.portal.apprbs.com.br/api/popups/${id}`, { headers, validateStatus: () => true, timeout: 30_000 }).catch(() => undefined),
            axios.get(`https://admin.portal.apprbs.com.br/api/popups/querys/${id}`, { headers, validateStatus: () => true, timeout: 30_000 }).catch(() => undefined),
          ]).then(([res, queryRes]) => ({ id, res, queryRes }))
        )
      );
      const popupById = new Map(
        popupResults
          .filter(({ res }) => res && res.status < 400)
          .map(({ id, res, queryRes }) => [id, parsePopup(res!.data, queryRes && queryRes.status < 400 ? queryRes.data : undefined, fieldCatalog, catalogs)])
      );
      for (const enc of popupTargets) if (enc.popupId) enc.popupDetalhe = popupById.get(enc.popupId);
    }

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url,
      httpMethod: "POST",
      httpStatus: selectedStageRes.status,
      requestSummary: { idPs, stageId } as Prisma.InputJsonValue,
      responseSummary: { passos: etapa.passos.length, warnings } as Prisma.InputJsonValue,
    });

    return { success: true, etapa, warnings };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "POST", idPs, error });
    return { success: false, error: (error as Error).message };
  }
}
