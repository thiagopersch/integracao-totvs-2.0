"use server"

import { getIntegrationConfig } from "@/lib/integration-config"
import { requireAnyPermission } from "@/lib/rbac"
import { hasRequiredCredentials, type PsCredentials } from "@/lib/ps-docs/credential"
import { PS_STRUCTURE_GRANTS, sessionErrorMessage, logApiCall, logAndNotifyFailure } from "@/lib/ps-docs/api-helpers"
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client"
import { listActivePortals } from "@/lib/ps-docs/server/portal-structure"

export type ListComparePortalsResult =
  | { success: true; portals: { id: number; title: string }[]; warning?: string }
  | { success: false; error: string }

/** Active portals of the cookie's institution, for the "Comparar processos" pickers. Same reader
 *  as "Análise de logs" (`fetchLogPortals`), but guarded by the PS structure grants. */
export async function listComparePortals(input: { credentials: PsCredentials }): Promise<ListComparePortalsResult> {
  const { organizationId, userId } = await requireAnyPermission(PS_STRUCTURE_GRANTS)
  if (!hasRequiredCredentials(input.credentials)) return { success: false, error: "Informe os cookies da sessão do portal admin" }

  const url = "https://admin.portal.apprbs.com.br/api/portal"
  try {
    const { timeoutMs } = await getIntegrationConfig(organizationId, "RUBEUS")
    const { total, portals, warning } = await listActivePortals(createRubeusClient(input.credentials, { timeoutMs }))
    await logApiCall({ organizationId, userId, integration: "PS_DOCS", url, httpMethod: "GET", httpStatus: 200, responseSummary: { total, ativos: portals.length } })
    return {
      success: true,
      portals: portals.map(([id, title]) => ({ id, title: title || `Portal ${id}` })).sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
      warning,
    }
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: "-", error })
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message ?? "Falha ao consultar os portais" }
  }
}
