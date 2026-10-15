"use server";

import { requireAnyPermission } from "@/lib/rbac";
import { hasRequiredCredentials, type PsCredentials } from "@/lib/ps-docs/credential";
import { PS_STRUCTURE_GRANTS, sessionErrorMessage, logApiCall, logAndNotifyFailure } from "@/lib/ps-docs/api-helpers";
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client";
import { listPortalProcesses, loadPortalOverview } from "@/lib/ps-docs/server/portal-structure";
import type { PortalOverviewSpec, PortalProcessRef } from "@/lib/ps-docs/types";

/**
 * Documents an entire portal — `admin.portal.apprbs.com.br/api/portal/*`, `/api/settings/*` and
 * `/api/pages` — as opposed to a single processo seletivo (see `actions/integrations/ps-docs.ts`).
 * Confirmed against `admin.portal.apprbs.com.br/administrativo/portal/{idPortal}`'s own requests:
 *  - `GET  /api/portal/general/{idPortal}`
 *  - `POST /api/settings/totvs-query/list` body `{ local_id, portal_id }`
 *  - `GET  /api/settings/scripts/portal/{idPortal}`
 *  - `GET  /api/settings/integrations/totvs-integrator/portal/{idPortal}`
 *  - `GET  /api/portal/login-settings/{idPortal}`
 *  - `GET  /api/portal/domain/{idPortal}`
 *  - `GET  /api/portal/totvs/{idPortal}`
 *  - `GET  /api/pages`
 *  - `GET  /api/portal/selective-process-local/{idPortal}` (active processes, documented one by
 *    one afterwards by the existing `listSelectiveProcessStages`/`fetchStageDocumentation`)
 * The requests and parsing live in `lib/ps-docs/server/portal-structure.ts`; these actions add
 * the permission check and the API log.
 */
const API_ROOT = "https://admin.portal.apprbs.com.br/api";

export interface FetchPortalOverviewResult {
  success: boolean;
  error?: string;
  overview?: PortalOverviewSpec;
}

export async function fetchPortalOverview(input: { credentials: PsCredentials; idPortal: string; localId?: string }): Promise<FetchPortalOverviewResult> {
  const { organizationId, userId } = await requireAnyPermission(PS_STRUCTURE_GRANTS);

  const idPortal = input.idPortal.trim();
  const credentials = input.credentials;
  const localId = Number(input.localId?.trim() || "2") || 2;
  if (!idPortal || !hasRequiredCredentials(credentials)) return { success: false, error: "Informe os cookies da sessão e o ID do Portal" };

  const generalUrl = `${API_ROOT}/portal/general/${idPortal}`;

  try {
    const overview = await loadPortalOverview(createRubeusClient(credentials), idPortal, localId);

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url: generalUrl,
      httpMethod: "GET",
      httpStatus: 200,
      requestSummary: { idPortal },
      responseSummary: { consultas: overview.consultas.length, integracoes: overview.integracoes.length },
    });

    return { success: true, overview };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url: generalUrl, method: "GET", idPs: idPortal, error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
  }
}

export interface ListPortalProcessesResult {
  success: boolean;
  error?: string;
  processes?: PortalProcessRef[];
}

export async function listPortalSelectiveProcesses(input: { credentials: PsCredentials; idPortal: string }): Promise<ListPortalProcessesResult> {
  const { organizationId, userId } = await requireAnyPermission(PS_STRUCTURE_GRANTS);

  const idPortal = input.idPortal.trim();
  const credentials = input.credentials;
  if (!idPortal || !hasRequiredCredentials(credentials)) return { success: false, error: "Informe os cookies da sessão e o ID do Portal" };

  const url = `${API_ROOT}/portal/selective-process-local/${idPortal}`;

  try {
    const { total, processes } = await listPortalProcesses(createRubeusClient(credentials), idPortal);

    await logApiCall({ organizationId, userId, integration: "PS_DOCS", url, httpMethod: "GET", httpStatus: 200, requestSummary: { idPortal }, responseSummary: { total, ativos: processes.length } });

    return { success: true, processes };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: idPortal, error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
  }
}
