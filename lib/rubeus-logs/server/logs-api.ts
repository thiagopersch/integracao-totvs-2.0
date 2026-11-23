import { asArray, unwrapData, type Raw } from "@/lib/ps-docs/api-helpers"
import { httpError, type RubeusClient } from "@/lib/ps-docs/server/rubeus-client"
import type { RubeusLogCategory, RubeusLogDetail, RubeusLogRow } from "@/lib/rubeus-logs/types"

/**
 * Rubeus admin log endpoints, as called by `admin.portal.apprbs.com.br/administrativo/definicoes`:
 *  - `GET  /api/settings/log-categories`
 *  - `POST /api/settings/log-filter` body `{ type_id: number[], created_at: [from, to], portal_id: number[] }`
 *  - `POST /api/settings/log-show`   body `{ categories_id, id }`
 */
export const LOGS_API_ROOT = "https://admin.portal.apprbs.com.br/api/settings"

/** `log-filter` scans every log table of the portal and routinely takes longer than the default
 *  RUBEUS timeout (30 s) — it gets at least this much. */
export const LOG_FILTER_MIN_TIMEOUT_MS = 180_000

/** Axios timeout/abort → readable message (the raw one is "timeout of 30000ms exceeded"). */
export function timeoutMessage(error: unknown): string | undefined {
  const e = error as { code?: string; message?: string } | null
  if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT" || /timeout of \d+ms exceeded/i.test(e?.message ?? "")) {
    return "O portal Rubeus demorou demais para responder à busca de logs. Tente um período menor ou só o tipo Erro."
  }
  return undefined
}

const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v))
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v))

function toRow(r: Raw): RubeusLogRow {
  return {
    id: Number(r.id),
    description: str(r.description),
    portal_id: num(r.portal_id),
    duration: num(r.duration),
    portal_title: str(r.portal_title),
    selective_process_id: num(r.selective_process_id),
    selective_process_title: str(r.selective_process_title),
    created_at: String(r.created_at ?? ""),
    categories_title: str(r.categories_title),
    categories_id: str(r.categories_id),
    log_type_id: num(r.log_type_id),
    person_name: str(r.person_name),
  }
}

function toDetail(r: Raw): RubeusLogDetail {
  return {
    id: Number(r.id),
    created_at: String(r.created_at ?? ""),
    updated_at: str(r.updated_at),
    user_name: str(r.user_name),
    observation: str(r.observation),
    duration: num(r.duration),
    portal_title: str(r.portal_title),
    selective_process_title: str(r.selective_process_title),
    categories_title: str(r.categories_title),
    categories_id: str(r.categories_id),
    stage_title: str(r.stage_title),
    step_title: str(r.step_title),
    log_location_title: str(r.log_location_title),
    // Kept as raw strings: either a payload (formatted on screen) or a signed file URL (download).
    sent: r.sent === null || r.sent === undefined ? null : typeof r.sent === "string" ? r.sent : JSON.stringify(r.sent),
    result: r.result === null || r.result === undefined ? null : typeof r.result === "string" ? r.result : JSON.stringify(r.result),
    description: str(r.description),
    person_name: str(r.person_name),
    log_status_id: num(r.log_status_id),
  }
}

function assertOk(res: { status: number; data: unknown }, what: string) {
  if (res.status >= 400) throw httpError(res.status, what)
  const body = res.data as Raw | null
  if (body && typeof body === "object" && body.success === false) {
    throw new Error(`O portal recusou ${what}${typeof body.message === "string" ? `: ${body.message}` : ""}`)
  }
}

export async function listLogCategories(client: RubeusClient): Promise<RubeusLogCategory[]> {
  const res = await client.get(`${LOGS_API_ROOT}/log-categories`)
  assertOk(res, "as categorias de log")
  return asArray(unwrapData(res.data))
    .map((c) => ({ id: Number(c.id), title: String(c.title ?? "") }))
    .filter((c) => Number.isInteger(c.id))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
}

export async function filterLogs(
  client: RubeusClient,
  params: { typeIds: number[]; from: string; to: string; portalId: number; timeoutMs?: number }
): Promise<RubeusLogRow[]> {
  const res = await client.post(
    `${LOGS_API_ROOT}/log-filter`,
    { type_id: params.typeIds, created_at: [params.from, params.to], portal_id: [params.portalId] },
    { timeout: Math.max(params.timeoutMs ?? 0, LOG_FILTER_MIN_TIMEOUT_MS) }
  )
  assertOk(res, "os logs")
  return asArray(unwrapData(res.data)).map(toRow).filter((r) => Number.isFinite(r.id))
}

export async function showLog(client: RubeusClient, params: { categoriesId: string; id: number }): Promise<RubeusLogDetail> {
  const res = await client.post(`${LOGS_API_ROOT}/log-show`, { categories_id: params.categoriesId, id: params.id })
  assertOk(res, `o log ${params.id}`)
  const data = unwrapData(res.data)
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`O log ${params.id} não foi encontrado`)
  return toDetail(data as Raw)
}
