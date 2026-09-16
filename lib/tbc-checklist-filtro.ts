import type { SchemaTable } from "@/utils/soap-schema"

/**
 * Default Filtro template for a Data Server's first (main) table — one `TABLE.PKFIELD = ''` per
 * primary-key field, joined by AND, so the user only has to fill in the real values. Falls back to
 * the table's first field when no primary key is declared in the schema.
 */
export function buildDefaultFiltro(tables: SchemaTable[]): string {
  const mainTable = tables[0]
  if (!mainTable) return ""
  const pkFields = mainTable.fields.filter((f) => f.isPrimaryKey)
  const fields = pkFields.length ? pkFields : mainTable.fields.slice(0, 1)
  if (!fields.length) return ""
  return fields.map((f) => `${mainTable.name}.${f.name} = ''`).join(" AND ")
}
