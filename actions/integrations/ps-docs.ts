"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import { buildFieldCatalog, buildIdTitleCatalog, buildStringKeyedCatalog, parseEtapa, extractTituloPortal, type ActionCatalogs, type StageRef } from "@/lib/ps-docs/parse-structure";
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

function authHeaders(tokenPs: string) {
  return { Authorization: `Bearer ${tokenPs}`, "Content-Type": "application/json" };
}

/** `GET /api/settings/fields` returns a smaller/wrong catalog (764 items, missing ids like 316191
 *  "IDPS") when called with only `Authorization: Bearer` — confirmed NOT a cookie/session issue
 *  (the browser's own request carries no `Cookie` header either) and NOT a cache issue (adding
 *  `Cache-Control`/`Pragma`/`Referer` alone didn't change the result). What's left as the
 *  difference from the browser's real request is the same-origin/CORS fingerprint a WAF or
 *  gateway in front of this route could use to route "browser" traffic differently from a
 *  server-to-server call: `Origin`, `Sec-Fetch-*`, and a real browser `User-Agent`. */
function settingsFieldsHeaders(tokenPs: string) {
  return {
    ...authHeaders(tokenPs),
    Accept: "application/json, text/plain, */*",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Referer: "https://admin.portal.apprbs.com.br/administrativo/definicoes",
    Origin: "https://admin.portal.apprbs.com.br",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
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

type Raw = Record<string, unknown>;

function unwrapData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const obj = payload as Raw;
  return "data" in obj ? obj.data : obj;
}

function asArray(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((v): v is Raw => !!v && typeof v === "object");
  return [];
}

/** Best-effort: logging/notifying about a failure must never itself become the error the user
 *  sees. Without this guard, a DB issue here (e.g. a stale `organizationId` in a dev/test session
 *  violating the `api_logs_organization_id_fkey` foreign key) throws and replaces the real,
 *  actionable error — the caller's `catch` never gets to `return { success: false, error }`, and
 *  the raw Prisma stack trace leaks to the client instead of telling the user which PS Docs call
 *  actually failed. */
async function logAndNotifyFailure(params: { organizationId: string; userId: string; url: string; method: string; idPs: string; error: unknown }) {
  try {
    const errorMessage = (params.error as Error).message;
    await prisma.apiLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        integration: "PS_DOCS",
        url: params.url,
        httpMethod: params.method,
        error: errorMessage,
        requestSummary: { idPs: params.idPs } as Prisma.InputJsonValue,
      },
    });
    const notification = buildIntegrationTestFailedNotification({ integration: "PS_DOCS", errorMessage, errorKind: classifyError(params.error), url: params.url });
    await notificationService.create({ organizationId: params.organizationId, userId: params.userId, ...notification });
  } catch (logError) {
    console.error("[PS_DOCS] Falha ao registrar log/notificação de erro (não bloqueante):", logError);
  }
}

/** Same non-blocking guard as `logAndNotifyFailure`, for the success-path `apiLog` writes — a
 *  logging failure (e.g. the same `organizationId` FK issue) must not turn a successful fetch
 *  into a thrown error. */
async function logApiCall(data: Prisma.ApiLogUncheckedCreateInput) {
  try {
    await prisma.apiLog.create({ data });
  } catch (logError) {
    console.error("[PS_DOCS] Falha ao registrar log de sucesso (não bloqueante):", logError);
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

    const standardFieldsCatalog = buildFieldCatalog(standardFieldsRes.data);
    const settingsFieldsCatalog = settingsFieldsRes.status < 400 ? buildFieldCatalog(settingsFieldsRes.data) : new Map<number, string>();
    const fieldCatalog = new Map([...standardFieldsCatalog, ...settingsFieldsCatalog]);

    // The remaining catalogs are only used to enrich the "Ações"/"Encaminhamentos" sections —
    // a failed lookup (expired permission on that route, etc.) shouldn't block the whole document,
    // so these are resolved best-effort instead of throwing on a non-2xx status. A failure is
    // silent to the pipeline (the affected section just shows "#id" placeholders) but is now
    // surfaced as a `catalogWarnings` entry so it isn't a silent black box — without a live token
    // in every debugging session, a status code in the warning list is the only way to tell a
    // real failure apart from "the section just has no popups configured".
    const catalogWarnings: string[] = [];
    // TEMPORARY diagnostic (round-trip verification): the response shape for settings/fields was
    // confirmed correct against a real sample, and the fetch reports no error, yet resolved names
    // still weren't showing up in the generated doc — this line proves how many entries actually
    // made it into `fieldCatalog` so we can tell a plumbing bug from a data bug without guessing.
    const settingsFieldsRawCount = asArray(unwrapData(settingsFieldsRes.data)).length;
    catalogWarnings.push(
      `[Diagnóstico] settings/fields: HTTP ${settingsFieldsRes.status}, ${settingsFieldsRawCount} itens brutos no array, ${settingsFieldsCatalog.size} no catálogo. standard-fields: ${standardFieldsCatalog.size}. Total únicos: ${fieldCatalog.size}. Campo 316191 resolvido para: "${fieldCatalog.get(316191) ?? "NÃO ENCONTRADO"}".`
    );
    const checkCatalog = (label: string, res: { status: number }) => {
      if (res.status >= 400) catalogWarnings.push(`Catálogo "${label}" indisponível (HTTP ${res.status}) — os itens correspondentes podem aparecer como "#id" em vez do nome.`);
    };
    checkCatalog("Campos do app (settings/fields)", settingsFieldsRes);
    // The status can be a lying 200 if this route redirects to an HTML login page instead of
    // returning JSON (e.g. if it needs a session cookie our server-side call can't send, unlike
    // popups/pages/standard-fields which are confirmed to work with just the Bearer token) — catch
    // that case too, since `checkCatalog` alone would stay silent about it.
    if (settingsFieldsRes.status < 400 && settingsFieldsCatalog.size === 0) {
      catalogWarnings.push(
        'Catálogo "Campos do app (settings/fields)" retornou HTTP 200 mas 0 campos utilizáveis — provavelmente não é JSON (ex.: página de login), possivelmente por exigir autenticação além do Bearer token. Campos ausentes em standard-fields continuam aparecendo como "campo #id".'
      );
    }
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
    const [selectedStageRes, feedbackRes] = await Promise.all([
      axios.post(url, { stage_id: stageId, editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.post(`${BASE_URL}/feedback`, { stage_id: stageId, editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }),
    ]);

    if (selectedStageRes.status >= 400) throw Object.assign(new Error(`HTTP ${selectedStageRes.status} ao consultar selected-stage`), { response: { status: selectedStageRes.status } });

    // `fieldCatalog` is built solely from `POST /standard-fields` (the only field-name source
    // confirmed correct) — an earlier version also tried a per-id `GET /api/custom-component/{id}`
    // fallback for ids missing from that catalog, but real tests showed it returning WRONG labels
    // for system-field ids (e.g. field_id 316191 "IDPS" resolving to "Botões") instead of failing
    // loudly, so it was removed. An id `standard-fields` doesn't cover now renders honestly as
    // "campo #<id>" instead of a plausible-looking wrong name — don't reintroduce a per-id lookup
    // without confirming live that it returns the *right* component for that id.
    const fieldCatalog = new Map(input.fieldCatalogEntries);

    const { etapa, warnings } = parseEtapa(
      input.stage,
      { list: input.stage.list, selectedStage: selectedStageRes.data, feedback: feedbackRes.status < 400 ? feedbackRes.data : undefined },
      fieldCatalog,
      input.actionCatalogEntries ? toActionCatalogs(input.actionCatalogEntries) : undefined
    );

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
