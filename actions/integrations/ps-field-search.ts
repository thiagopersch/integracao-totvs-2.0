"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { hasRequiredCredentials, type PsCredentials } from "@/lib/ps-docs/credential";
import { authHeaders, sessionErrorMessage, unwrapData, logApiCall, logAndNotifyFailure, type Raw } from "@/lib/ps-docs/api-helpers";
import { harvestFieldLabels, EMPTY_CATALOGS } from "@/lib/ps-docs/parse-structure";
import { parseComponentDetail, type ComponentDetail } from "@/lib/ps-docs/component-detail";
import { toActionCatalogs, type ActionCatalogEntries } from "@/lib/ps-docs/server/process-structure";
import type { Prisma } from "@/generated/prisma/client";

/**
 * "Buscar elementos" — loads one component's full config on demand, when a result row is
 * expanded: `GET /api/custom-component/{id}` (button_actions with their actions/fields/
 * parameters, totvs_query, forwardData). The structure sweep itself is one streamed request,
 * `app/api/ps-field-search/route.ts` (see `lib/ps-docs/server/field-search-sweep.ts`).
 */
const API_ROOT = "https://admin.portal.apprbs.com.br/api";

export interface ComponentDetailResult {
  success: boolean;
  error?: string;
  detail?: ComponentDetail;
}

export async function fetchComponentDetail(input: {
  credentials: PsCredentials;
  componentId: number;
  fieldCatalogEntries?: [number, string][];
  actionCatalogEntries?: ActionCatalogEntries;
}): Promise<ComponentDetailResult> {
  const { organizationId, userId } = await requirePermission("ps_field_search", "execute");
  if (!hasRequiredCredentials(input.credentials)) return { success: false, error: "Informe os cookies da sessão" };
  const componentId = Number(input.componentId);
  if (!Number.isInteger(componentId) || componentId <= 0) return { success: false, error: "Componente inválido" };

  const url = `${API_ROOT}/custom-component/${componentId}`;
  const headers = { ...authHeaders(input.credentials), Referer: "https://admin.portal.apprbs.com.br/administrativo/definicoes" };
  try {
    const res = await axios.get(url, { headers, validateStatus: () => true, timeout: 30_000 });
    if (res.status >= 400) throw Object.assign(new Error(`HTTP ${res.status} ao consultar o componente #${componentId}`), { response: { status: res.status } });

    const raw = unwrapData(res.data);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Resposta inesperada ao consultar o componente #${componentId}`);

    const baseCatalog = new Map(input.fieldCatalogEntries ?? []);
    const harvested = harvestFieldLabels(raw);
    const fieldCatalog = harvested.size > 0 ? new Map([...harvested, ...baseCatalog]) : baseCatalog;
    const detail = parseComponentDetail(raw as Raw, fieldCatalog, (input.actionCatalogEntries ? toActionCatalogs(input.actionCatalogEntries) : EMPTY_CATALOGS));

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url,
      httpMethod: "GET",
      httpStatus: res.status,
      requestSummary: { componentId } as Prisma.InputJsonValue,
      responseSummary: { buttonActions: detail.grupos.length } as Prisma.InputJsonValue,
    });
    return { success: true, detail };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: "-", error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
  }
}
