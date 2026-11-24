"use server"

import { getIntegrationConfig } from "@/lib/integration-config"
import { requirePermission } from "@/lib/rbac"
import { hasRequiredCredentials, type PsCredentials } from "@/lib/ps-docs/credential"
import { logApiCall, logAndNotifyFailure, sessionErrorMessage } from "@/lib/ps-docs/api-helpers"
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client"
import { listActivePortals, listPortalProcesses } from "@/lib/ps-docs/server/portal-structure"
import { LOGS_API_ROOT, filterLogs, listLogCategories, showLog, timeoutMessage } from "@/lib/rubeus-logs/server/logs-api"
import { LOG_TYPE_IDS, type RubeusLogCategory, type RubeusLogDetail, type RubeusLogRow } from "@/lib/rubeus-logs/types"
import { logFilterSchema, logProcessesSchema, logShowSchema, type LogFilterInput, type LogProcessesInput, type LogShowInput } from "@/schemas/rubeus-logs.schema"

/**
 * "Inscrições e matrículas → Análise de logs": reads the Rubeus portal admin logs with the
 * session cookies the user pastes (never stored). The requests live in
 * `lib/rubeus-logs/server/logs-api.ts`; these actions add the permission check and the API log.
 */
const RESOURCE = "ps_log_analysis"

async function rubeusTimeout(organizationId: string) {
  return (await getIntegrationConfig(organizationId, "RUBEUS")).timeoutMs
}

async function clientFor(organizationId: string, credentials: PsCredentials) {
  return createRubeusClient(credentials, { timeoutMs: await rubeusTimeout(organizationId) })
}

const failure = (error: unknown) => sessionErrorMessage(error) ?? timeoutMessage(error) ?? (error as Error).message ?? "Falha ao consultar o portal"

export type FetchLogPortalsResult = { success: true; portals: { id: number; title: string }[]; warning?: string } | { success: false; error: string }

export async function fetchLogPortals(input: { credentials: PsCredentials }): Promise<FetchLogPortalsResult> {
  const { organizationId, userId } = await requirePermission(RESOURCE, "execute")
  if (!hasRequiredCredentials(input.credentials)) return { success: false, error: "Informe os cookies da sessão do portal admin" }

  const url = "https://admin.portal.apprbs.com.br/api/portal"
  try {
    const { total, portals, warning } = await listActivePortals(await clientFor(organizationId, input.credentials))
    await logApiCall({ organizationId, userId, integration: "PS_DOCS", url, httpMethod: "GET", httpStatus: 200, responseSummary: { total, ativos: portals.length } })
    return {
      success: true,
      portals: portals.map(([id, title]) => ({ id, title: title || `Portal ${id}` })).sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
      warning,
    }
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: "-", error })
    return { success: false, error: failure(error) }
  }
}

export type FetchLogProcessesResult = { success: true; processes: { id: number; name: string }[] } | { success: false; error: string }

/** Active selective processes of the chosen portal — feeds the "Processo seletivo" filter. */
export async function fetchLogProcesses(input: LogProcessesInput): Promise<FetchLogProcessesResult> {
  const { organizationId, userId } = await requirePermission(RESOURCE, "execute")
  const parsed = logProcessesSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }
  const { credentials, portalId } = parsed.data

  const url = `https://admin.portal.apprbs.com.br/api/portal/selective-process-local/${portalId}`
  try {
    const { total, processes } = await listPortalProcesses(await clientFor(organizationId, credentials), String(portalId))
    await logApiCall({ organizationId, userId, integration: "PS_DOCS", url, httpMethod: "GET", httpStatus: 200, responseSummary: { total, ativos: processes.length } })
    return {
      success: true,
      processes: processes
        .map((p) => ({ id: Number(p.id), name: p.name }))
        .filter((p) => Number.isInteger(p.id) && p.id > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: String(portalId), error })
    return { success: false, error: failure(error) }
  }
}

export type SearchRubeusLogsResult = { success: true; logs: RubeusLogRow[]; categories: RubeusLogCategory[] } | { success: false; error: string }

export async function searchRubeusLogs(input: LogFilterInput): Promise<SearchRubeusLogsResult> {
  const { organizationId, userId } = await requirePermission(RESOURCE, "execute")
  const parsed = logFilterSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }
  const { credentials, type, from, to, portalId, selectiveProcessId, minDurationMs } = parsed.data

  const url = `${LOGS_API_ROOT}/log-filter`
  try {
    const timeoutMs = await rubeusTimeout(organizationId)
    const client = createRubeusClient(credentials, { timeoutMs })
    // Categories only feed the table's filter — a failure there must not hide the logs.
    const [logs, categories] = await Promise.all([
      filterLogs(client, { typeIds: LOG_TYPE_IDS[type], from, to, portalId, selectiveProcessId, minDurationMs, timeoutMs }),
      listLogCategories(client).catch(() => [] as RubeusLogCategory[]),
    ])
    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url,
      httpMethod: "POST",
      httpStatus: 200,
      requestSummary: { portalId, selectiveProcessId, type, from, to, minDurationMs },
      responseSummary: { logs: logs.length },
    })
    return { success: true, logs, categories }
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "POST", idPs: String(portalId), error })
    return { success: false, error: failure(error) }
  }
}

export type FetchRubeusLogDetailResult = { success: true; log: RubeusLogDetail } | { success: false; error: string }

export async function fetchRubeusLogDetail(input: LogShowInput): Promise<FetchRubeusLogDetailResult> {
  const { organizationId, userId } = await requirePermission(RESOURCE, "execute")
  const parsed = logShowSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }
  const { credentials, categoriesId, id } = parsed.data

  const url = `${LOGS_API_ROOT}/log-show`
  try {
    const log = await showLog(await clientFor(organizationId, credentials), { categoriesId, id })
    await logApiCall({ organizationId, userId, integration: "PS_DOCS", url, httpMethod: "POST", httpStatus: 200, requestSummary: { categoriesId, id } })
    return { success: true, log }
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "POST", idPs: String(id), error })
    return { success: false, error: failure(error) }
  }
}
