import type { RubeusLogDetail, RubeusLogRow } from "@/lib/rubeus-logs/types"

/** Pure formatting helpers for the "Análise de logs" page (safe on client and server). */

export const EMPTY_PAYLOAD_MESSAGE = "A consulta não retornou dados."

export function isErrorLog(typeId: number | null | undefined): boolean {
  return Number(typeId) === 1
}

/** `log_type_id` 1 = Erro; anything else = Info. */
export function logTypeLabel(typeId: number | null | undefined): "Erro" | "Info" {
  return isErrorLog(typeId) ? "Erro" : "Info"
}

/** Milliseconds → seconds number (2 decimals), for sorting/export. */
export function durationSeconds(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return null
  return Math.round(Number(ms) / 10) / 100
}

/** Milliseconds → "12,5 segundos" (pt-BR, up to 2 decimals); "-" when missing. */
export function formatDurationSeconds(ms: number | null | undefined): string {
  const seconds = durationSeconds(ms)
  if (seconds === null) return "-"
  return `${seconds.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} segundos`
}

/** "2026-11-23 12:59:32" → "23/11/2026 12:59:32". Rubeus already sends local time, so no timezone math. */
export function formatLogDate(value: string | null | undefined): string {
  if (!value) return "-"
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)
  if (!m) return value
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6] ?? "00"}`
}

/** "-" for null/undefined/blank. */
export function dash(value: unknown): string {
  if (value === null || value === undefined) return "-"
  const text = String(value).trim()
  return text ? text : "-"
}

/** `sent`/`result` holding a file link (signed storage URL) instead of the payload itself. */
export function isDownloadUrl(value: string | null | undefined): boolean {
  if (!value) return false
  const text = value.trim()
  if (!/^https?:\/\/\S+$/i.test(text)) return false
  try {
    new URL(text)
    return true
  } catch {
    return false
  }
}

export type FormattedPayload = { kind: "empty" | "json" | "text"; text: string }

/**
 * Readable version of a `sent`/`result` payload:
 *  - JSON object/array → pretty-printed;
 *  - JSON string (e.g. an HTML error page encoded with `\n` and `ç`) → the decoded text;
 *  - anything else → as is.
 */
export function formatPayload(raw: string | null | undefined): FormattedPayload {
  if (raw === null || raw === undefined || !String(raw).trim()) return { kind: "empty", text: EMPTY_PAYLOAD_MESSAGE }
  const text = String(raw)
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { kind: "text", text }
  }
  // A JSON string may itself hold JSON (double-encoded payloads).
  if (typeof value === "string") {
    const inner = value.trim()
    if (!inner) return { kind: "empty", text: EMPTY_PAYLOAD_MESSAGE }
    if (/^[[{]/.test(inner)) {
      try {
        return { kind: "json", text: JSON.stringify(JSON.parse(inner), null, 2) }
      } catch {
        // Not JSON — fall through to plain text.
      }
    }
    return { kind: "text", text: value }
  }
  if (value === null) return { kind: "empty", text: EMPTY_PAYLOAD_MESSAGE }
  if (typeof value === "object") {
    if (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0) return { kind: "empty", text: EMPTY_PAYLOAD_MESSAGE }
    return { kind: "json", text: JSON.stringify(value, null, 2) }
  }
  return { kind: "text", text: String(value) }
}

export type LogExportFieldKey =
  | "id"
  | "tipo"
  | "created_at"
  | "categoria"
  | "descricao"
  | "portal"
  | "processo"
  | "pessoa"
  | "duracao"
  | "ps_id"
  | "etapa"
  | "passo"
  | "localizacao"
  | "updated_at"
  | "usuario"
  | "observacao"
  | "sent"
  | "result"

/** Value of an exported cell: `link` cells become hyperlinks in Excel and show the URL elsewhere. */
export type LogExportValue = string | number | { text: string; link: string }

export interface LogExportField {
  key: LogExportFieldKey
  label: string
  /** "table" = columns of the grid (pre-selected); "detail" = only in the log dialog (needs `log-show`). */
  group: "table" | "detail"
  value: (row: RubeusLogRow, detail: RubeusLogDetail | undefined, portalFallback: string) => LogExportValue
}

/** `sent`/`result` → the file link itself; inline payloads (no link exists) → their formatted text. */
export function payloadExportValue(raw: string | null | undefined): LogExportValue {
  if (isDownloadUrl(raw)) {
    const url = String(raw).trim()
    return { text: url, link: url }
  }
  const payload = formatPayload(raw)
  return payload.kind === "empty" ? "-" : payload.text
}

/** Every field the export dialog offers, in output order. */
export const LOG_EXPORT_FIELDS: LogExportField[] = [
  { key: "id", label: "ID", group: "table", value: (r) => r.id },
  { key: "tipo", label: "Tipo", group: "table", value: (r) => logTypeLabel(r.log_type_id) },
  { key: "created_at", label: "Criado em", group: "table", value: (r) => formatLogDate(r.created_at) },
  { key: "categoria", label: "Categoria", group: "table", value: (r) => dash(r.categories_title) },
  { key: "descricao", label: "Descrição", group: "table", value: (r) => dash(r.description) },
  { key: "portal", label: "Portal", group: "table", value: (r, _d, fallback) => dash(r.portal_title || fallback) },
  { key: "processo", label: "Processo seletivo", group: "table", value: (r) => dash(r.selective_process_title) },
  { key: "pessoa", label: "Pessoa", group: "table", value: (r) => dash(r.person_name) },
  { key: "duracao", label: "Duração (s)", group: "table", value: (r) => durationSeconds(r.duration) ?? "-" },
  { key: "ps_id", label: "ID do PS", group: "detail", value: (r) => dash(r.selective_process_id) },
  { key: "etapa", label: "Etapa", group: "detail", value: (_r, d) => dash(d?.stage_title) },
  { key: "passo", label: "Passo", group: "detail", value: (_r, d) => dash(d?.step_title) },
  { key: "localizacao", label: "Localização", group: "detail", value: (_r, d) => dash(d?.log_location_title) },
  {
    key: "updated_at",
    label: "Última alteração",
    group: "detail",
    value: (_r, d) => (d?.updated_at && d.updated_at !== d.created_at ? formatLogDate(d.updated_at) : "-"),
  },
  { key: "usuario", label: "Usuário", group: "detail", value: (_r, d) => dash(d?.user_name) },
  { key: "observacao", label: "Observação", group: "detail", value: (_r, d) => dash(d?.observation) },
  { key: "sent", label: "Link do envio (sent)", group: "detail", value: (_r, d) => (d ? payloadExportValue(d.sent) : "-") },
  { key: "result", label: "Link do retorno (result)", group: "detail", value: (_r, d) => (d ? payloadExportValue(d.result) : "-") },
]

export const DEFAULT_LOG_EXPORT_KEYS: LogExportFieldKey[] = LOG_EXPORT_FIELDS.filter((f) => f.group === "table").map((f) => f.key)

/** Fields that only `log-show` returns — the ones the export has to fetch first. */
export function needsLogDetails(keys: readonly LogExportFieldKey[]): boolean {
  return LOG_EXPORT_FIELDS.some((f) => f.group === "detail" && f.key !== "ps_id" && keys.includes(f.key))
}

/** Header + rows of the chosen fields (catalog order), for Excel/CSV/PDF/TSV. */
export function buildLogExport(
  rows: RubeusLogRow[],
  details: ReadonlyMap<number, RubeusLogDetail>,
  keys: readonly LogExportFieldKey[],
  portalFallback = ""
): { headers: string[]; rows: LogExportValue[][] } {
  const fields = LOG_EXPORT_FIELDS.filter((f) => keys.includes(f.key))
  return {
    headers: fields.map((f) => f.label),
    rows: rows.map((r) => fields.map((f) => f.value(r, details.get(r.id), portalFallback))),
  }
}

/** Plain text of an export cell (links → the URL). */
export function exportValueText(v: LogExportValue): string | number {
  return typeof v === "object" ? v.text : v
}

/** Tab-separated text (header + rows) that pastes into Google Sheets/Excel as cells. Numbers use a comma decimal (pt-BR sheets). */
export function toTsv(header: readonly string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) =>
    (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }) : v).replace(/[\t\r\n]+/g, " ").trim()
  return [header, ...rows].map((row) => row.map(cell).join("\t")).join("\n")
}
