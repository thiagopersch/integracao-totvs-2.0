import type { RubeusLogRow } from "@/lib/rubeus-logs/types"

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

/** Spreadsheet columns shared by the Excel export and the "copy to Google Sheets" TSV. */
export const LOG_SHEET_HEADERS = ["ID", "Tipo", "Criado em", "Categoria", "Descrição", "Portal", "ID do PS", "Processo seletivo", "Pessoa", "Duração (s)"] as const

export function logsToSheetRows(rows: RubeusLogRow[], portalFallback = ""): (string | number)[][] {
  return rows.map((r) => [
    r.id,
    logTypeLabel(r.log_type_id),
    formatLogDate(r.created_at),
    dash(r.categories_title),
    dash(r.description),
    dash(r.portal_title || portalFallback),
    dash(r.selective_process_id),
    dash(r.selective_process_title),
    dash(r.person_name),
    durationSeconds(r.duration) ?? "-",
  ])
}

/** Tab-separated text (header + rows) that pastes into Google Sheets/Excel as cells. Numbers use a comma decimal (pt-BR sheets). */
export function toTsv(header: readonly string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) =>
    (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }) : v).replace(/[\t\r\n]+/g, " ").trim()
  return [header, ...rows].map((row) => row.map(cell).join("\t")).join("\n")
}
