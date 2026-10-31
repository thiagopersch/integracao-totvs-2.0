import type { SchemaTable } from "@/utils/soap-schema"

function lookupKnownValue(knownValues: Record<string, string>, fieldName: string): string | undefined {
  const target = fieldName.toLowerCase()
  for (const [key, value] of Object.entries(knownValues)) {
    if (key.toLowerCase() === target) return value
  }
  return undefined
}

/**
 * Default Filtro template for a Data Server's first (main) table — one `TABLE.PKFIELD = 'value'`
 * per primary-key field, joined by AND. When `knownValues` (case-insensitive, by field name)
 * already has a value for a given PK field — e.g. CODCOLIGADA/IDPS already discovered from the
 * selected processo seletivo — that real value is used instead of a blank `''` template, so
 * related Data Servers don't need the user to retype context that's already known.
 */
export function buildDefaultFiltro(tables: SchemaTable[], knownValues: Record<string, string> = {}): string {
  const mainTable = tables[0]
  if (!mainTable) return ""
  const pkFields = mainTable.fields.filter((f) => f.isPrimaryKey)
  const fields = pkFields.length ? pkFields : mainTable.fields.slice(0, 1)
  if (!fields.length) return ""
  return fields.map((f) => `${mainTable.name}.${f.name} = '${lookupKnownValue(knownValues, f.name) ?? ""}'`).join(" AND ")
}

/**
 * Filtro for a table from per-field values (the primary-key inputs): one `TABLE.FIELD = 'value'`
 * per non-empty value, joined by AND. Empty when nothing was filled — every field is optional.
 */
export function buildPkFiltro(tableName: string, values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, value]) => value.trim() !== "")
    .map(([name, value]) => `${tableName}.${name} = '${value.trim().replace(/'/g, "''")}'`)
    .join(" AND ")
}

/** One Data Server link as values: `fields` (columns of the linked Data Server's main table) and
 *  the value tuples its parent's loaded rows carry for them, in the same order. */
export type LinkFilter = { fields: string[]; tuples: string[][] }

const quoted = (value: string) => `'${value.trim().replace(/'/g, "''")}'`

/**
 * Filtro for a linked Data Server's main table: per link, `TABLE.FIELD IN ('a', 'b')` (one field)
 * or `((TABLE.A = 'x' AND TABLE.B = 'y') OR (...))` (several), all links joined by AND. Field names
 * are matched case-insensitively against `mainFieldNames` and written with their spelling — one not
 * there fails. Every link needs at least one tuple (no parent row = nothing to load, not a filtro).
 */
export function buildLinkFiltro(tableName: string, mainFieldNames: string[], links: LinkFilter[]): string {
  return links
    .map((link) => {
      const columns = link.fields.map((name) => {
        const column = mainFieldNames.find((f) => f.toLowerCase() === name.toLowerCase())
        if (!column) throw new Error(`O campo de vínculo ${name} não existe mais em ${tableName}.`)
        return `${tableName}.${column}`
      })
      if (!link.tuples.length) throw new Error("Vínculo sem valores para filtrar.")
      if (columns.length === 1) return `${columns[0]} IN (${link.tuples.map((t) => quoted(t[0])).join(", ")})`
      const tuples = link.tuples.map((t) => `(${columns.map((c, i) => `${c} = ${quoted(t[i])}`).join(" AND ")})`)
      return tuples.length === 1 ? tuples[0] : `(${tuples.join(" OR ")})`
    })
    .join(" AND ")
}

/** Values from `knownValues` (case-insensitive by field name) for each of `fieldNames`, keyed by
 *  the field's own spelling; fields with no known value come back as "". */
export function pickKnownPkValues(fieldNames: string[], knownValues: Record<string, string>): Record<string, string> {
  return Object.fromEntries(fieldNames.map((name) => [name, lookupKnownValue(knownValues, name) ?? ""]))
}
