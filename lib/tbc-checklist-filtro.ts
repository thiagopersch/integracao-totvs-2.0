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
