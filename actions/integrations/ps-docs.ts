"use server";

import { requireAnyPermission } from "@/lib/rbac";
import { hasRequiredCredentials, type PsCredentials } from "@/lib/ps-docs/credential";
import { PS_STRUCTURE_GRANTS, sessionErrorMessage, logApiCall, logAndNotifyFailure } from "@/lib/ps-docs/api-helpers";
import { EMPTY_CATALOGS, type StageRef } from "@/lib/ps-docs/parse-structure";
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client";
import { loadProcessStages, loadStage, toActionCatalogs, type ActionCatalogEntries, type StageListItem } from "@/lib/ps-docs/server/process-structure";
import type { EtapaSpec } from "@/lib/ps-docs/types";
import type { Prisma } from "@/generated/prisma/client";

export type { ActionCatalogEntries, StageListItem };

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
 *  closes a residual gap that would otherwise render as "campo #id". The request itself (with the
 *  browser-like headers it needs) now lives in `lib/ps-docs/server/process-structure.ts`. */
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
 *  id->name catalogs needed to describe button actions/encaminhamentos — see `loadProcessStages`. */
export async function listSelectiveProcessStages(input: { credentials: PsCredentials; idPs: string; crmDomain?: string }): Promise<ListStagesResult> {
  const { organizationId, userId } = await requireAnyPermission(PS_STRUCTURE_GRANTS);

  const idPs = input.idPs.trim();
  const credentials = input.credentials;
  if (!idPs || !hasRequiredCredentials(credentials)) return { success: false, error: "Informe os cookies da sessão e o ID PS" };

  const stageListUrl = `${BASE_URL}/opening-page-stages/${idPs}`;
  // Prefer the user-supplied CRM link (most reliable) over the one guessed from the token's own
  // `nomeInstituicao` claim — some tenants' CRM subdomain doesn't match the portal's institution
  // slug exactly, so the guess is only a fallback.
  const crmDomain = input.crmDomain?.trim();

  try {
    const res = await loadProcessStages(createRubeusClient(credentials), idPs, crmDomain);

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url: stageListUrl,
      httpMethod: "GET",
      httpStatus: 200,
      requestSummary: { idPs } as Prisma.InputJsonValue,
      responseSummary: { etapasAtivas: res.stages.length, etapasTotal: res.totalStages } as Prisma.InputJsonValue,
    });

    return {
      success: true,
      idPs,
      tituloPortal: res.tituloPortal,
      stages: res.stages,
      fieldCatalogEntries: [...res.fieldCatalog.entries()],
      actionCatalogEntries: res.actionCatalogEntries,
      catalogWarnings: res.catalogWarnings,
    };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url: stageListUrl, method: "GET", idPs, error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
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
 *  as it's ready. See `loadStage`. */
export async function fetchStageDocumentation(input: {
  credentials: PsCredentials;
  idPs: string;
  stage: StageRef;
  fieldCatalogEntries: [number, string][];
  actionCatalogEntries?: ActionCatalogEntries;
}): Promise<FetchStageResult> {
  const { organizationId, userId } = await requireAnyPermission(PS_STRUCTURE_GRANTS);

  const idPs = input.idPs.trim();
  const url = `${BASE_URL}/selected-stage/${idPs}`;

  try {
    // `fieldCatalog` comes only from `standard-fields` + the harvests in step 1 — an earlier
    // per-id `GET /api/custom-component/{id}` fallback returned WRONG labels for system-field ids
    // (e.g. 316191 "IDPS" -> "Botões"), so an uncovered id renders honestly as "campo #<id>".
    const catalogs = input.actionCatalogEntries ? toActionCatalogs(input.actionCatalogEntries) : EMPTY_CATALOGS;
    const { etapa, warnings } = await loadStage(createRubeusClient(input.credentials), idPs, input.stage, new Map(input.fieldCatalogEntries), catalogs);

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url,
      httpMethod: "POST",
      httpStatus: 200,
      requestSummary: { idPs, stageId: String(input.stage.list.id) } as Prisma.InputJsonValue,
      responseSummary: { passos: etapa.passos.length, warnings } as Prisma.InputJsonValue,
    });

    return { success: true, etapa, warnings };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "POST", idPs, error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
  }
}
