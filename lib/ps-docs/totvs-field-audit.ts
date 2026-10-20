/** "Integração TOTVS dos campos" (Buscar elementos): client-safe types, status rules and export
 *  rows. The server side that reads every field is `lib/ps-docs/server/totvs-field-audit.ts`. */

export type TotvsAuditStatus = "Configurado" | "Incompleto" | "Não configurado"

export const TOTVS_AUDIT_STATUSES: TotvsAuditStatus[] = ["Configurado", "Incompleto", "Não configurado"]

/** The three inputs of "Integração TOTVS" on the field's Identidade tab, in screen order. */
export type TotvsAuditItem = "tabela" | "campo" | "nome alternativo"

export interface TotvsIntegration {
  tabela?: string
  campo?: string
  nomeAlternativo?: string
  status: TotvsAuditStatus
  faltando: TotvsAuditItem[]
}

export interface TotvsFieldAuditRow extends TotvsIntegration {
  id: number
  nome: string
  tipo: string
  tabelaPs?: "Pessoa" | "Inscrição"
}

function filled(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  if (typeof value === "number") return String(value)
  return undefined
}

/** Reads `totvs_table`/`totvs_field`/`totvs_alternative_name` (same keys as
 *  `buildCampoDetalhado`) — all three are required for the mapping to count as configured. */
export function classifyTotvsIntegration(raw: Record<string, unknown>): TotvsIntegration {
  const tabela = filled(raw.totvs_table)
  const campo = filled(raw.totvs_field)
  const nomeAlternativo = filled(raw.totvs_alternative_name)
  const faltando: TotvsAuditItem[] = []
  if (!tabela) faltando.push("tabela")
  if (!campo) faltando.push("campo")
  if (!nomeAlternativo) faltando.push("nome alternativo")
  const status: TotvsAuditStatus =
    faltando.length === 0 ? "Configurado" : faltando.length === 3 ? "Não configurado" : "Incompleto"
  return { tabela, campo, nomeAlternativo, status, faltando }
}

/** "O que falta" column text. */
export function pendingMessage(row: Pick<TotvsIntegration, "status" | "faltando">): string {
  if (row.status === "Configurado") return ""
  if (row.status === "Não configurado")
    return "Integração TOTVS não configurada — configurar tabela, campo e nome alternativo"
  return `Falta configurar: ${row.faltando.join(", ")}`
}

export function auditRowsToSheetRows(rows: TotvsFieldAuditRow[]): Record<string, string | number>[] {
  return rows.map((r) => ({
    "ID do campo": r.id,
    Campo: r.nome,
    Tipo: r.tipo,
    "Tabela do PS": r.tabelaPs ?? "",
    "Tabela TOTVS": r.tabela ?? "",
    "Campo TOTVS": r.campo ?? "",
    "Nome alternativo": r.nomeAlternativo ?? "",
    Status: r.status,
    "O que falta": pendingMessage(r),
  }))
}
