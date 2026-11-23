import type { SqlDocEntry, SqlDocSource } from "@/lib/sql-docs/types"

export type QueryItemStatus = "idle" | "analyzing" | "done" | "error"

/** One query on the page: what the user provided plus the analysis state. */
export interface QueryItem {
  id: string
  source: SqlDocSource
  fileName?: string
  sentenceId?: string
  code: string
  title: string
  sql: string
  status: QueryItemStatus
  error?: string
  /** Characters the model has written so far (streaming feedback). */
  progressChars?: number
  entry?: SqlDocEntry
  /** Editable rules, one per line — what the document renders. */
  rulesText: string
}

export interface SentenceOption {
  id: string
  code: string
  name: string
  category: string | null
}

export function newQueryItem(source: QueryItem["source"], patch: Partial<QueryItem> = {}): QueryItem {
  return { id: crypto.randomUUID(), source, code: "", title: "", sql: "", status: "idle", rulesText: "", ...patch }
}

/** "RB.PS.CAP.001 - Cadastra modalidades.sql" → { code: "RB.PS.CAP.001", title: "Cadastra modalidades" }. */
export function codeAndTitleFromFileName(fileName: string): { code: string; title: string } {
  const base = fileName.replace(/\.(sql|txt)$/i, "").trim()
  const m = base.match(/^(\S+)\s+-\s+(.+)$/)
  return m ? { code: m[1], title: m[2].trim() } : { code: base, title: "" }
}
