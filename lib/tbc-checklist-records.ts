import type {
  ChecklistFieldMeta,
  ChecklistParent,
  ChecklistTableMeta,
  ChecklistTableResult,
} from "@/actions/integrations/tbc-checklist"
import { isConfiguredValue } from "@/lib/tbc-checklist-values"
import type { DataTable, SchemaTable } from "@/utils/soap-schema"

/** Pure builders of the checklist's records — shared by the server actions and the client, which
 *  assembles a Data Server's main table from the ReadRecord batches it requests one by one. */

const NAME_FIELD_PATTERN = /^(NOME|DESCRICAO|DESC)/i

/** Picks a human label for one row of a table: prefers a "nome"/"descrição" column, then the first
 *  non-PK field with a real value, prefixed by the row's last PK value (its own id, e.g. IDPS or
 *  IDAREAOFERTADA); falls back to the PK values, then a plain ordinal — so every accordion item has
 *  something to show even for oddly-shaped tables. */
export function pickRecordLabel(fields: ChecklistFieldMeta[], row: Record<string, string>, index: number): string {
  const hasValue = (name: string) => (row[name] ?? "").trim().length > 0
  const pkValues = fields.filter((f) => f.isPrimaryKey && hasValue(f.name)).map((f) => row[f.name])
  const nonPk = fields.filter((f) => !f.isPrimaryKey && hasValue(f.name))
  const nameField = nonPk.find((f) => NAME_FIELD_PATTERN.test(f.name) || /nome|descri/i.test(f.caption)) ?? nonPk[0]
  if (nameField) {
    const id = pkValues[pkValues.length - 1]
    return id ? `${id} - ${row[nameField.name]}` : row[nameField.name]
  }
  if (pkValues.length) return pkValues.join(" - ")
  return `Registro ${index + 1}`
}

export function toFieldMeta(table: SchemaTable): ChecklistTableMeta {
  return {
    name: table.name,
    fields: table.fields.map((f) => ({
      name: f.name,
      caption: f.caption && f.caption !== "-" ? f.caption : f.name,
      isPrimaryKey: f.isPrimaryKey,
      type: f.type,
    })),
  }
}

/** Merges a table's schema fields with the rows TOTVS returned for it. A field is "configurado"
 *  per `isConfiguredValue` (any value but an unchecked "F" flag). No rows → one blank record,
 *  flagged `empty`. */
export function buildTableResult(table: ChecklistTableMeta, rows: Record<string, string>[], keyPrefix = table.name): ChecklistTableResult {
  const effectiveRows = rows.length ? rows : [{}]
  return {
    table: table.name,
    empty: rows.length === 0,
    records: effectiveRows.map((row, index) => ({
      key: `${keyPrefix}-${index}`,
      label: pickRecordLabel(table.fields, row, index),
      fields: table.fields.map((field) => {
        const rawValue = row[field.name] ?? ""
        return {
          table: table.name,
          name: field.name,
          caption: field.caption,
          isPrimaryKey: field.isPrimaryKey,
          type: field.type,
          configurado: isConfiguredValue(rawValue),
          valor: rawValue,
        }
      }),
    })),
  }
}

/** Rows of `tableName` in a ReadView/ReadRecord result — matched case-insensitively, since the
 *  DataSet element name isn't guaranteed to share the GetSchema casing. */
export function rowsForTable(dataTables: DataTable[], tableName: string): Record<string, string>[] {
  const target = tableName.toLowerCase()
  return dataTables.filter((t) => t.name.toLowerCase() === target).flatMap((t) => t.rows)
}

/** Value of `field` in `row`, matching the column name case-insensitively. */
export function rowValue(row: Record<string, string>, field: string): string | undefined {
  const target = field.toLowerCase()
  for (const [key, value] of Object.entries(row)) {
    if (key.toLowerCase() === target) return value
  }
  return undefined
}

/** One main-table row's ReadRecord outcome — `row` is null when it failed or came back empty. */
export type ChecklistMainRecord = { primaryKey: string; row: Record<string, string> | null; error?: string }

/**
 * The main table's records and their `parents` (rows addressable by ReadRecord for the related
 * tables) from the ReadView rows plus one ReadRecord outcome per row, in the same order. A row
 * whose ReadRecord failed keeps its (partial) ReadView columns and carries the error.
 */
export function assembleMainTable(
  mainTable: ChecklistTableMeta,
  viewRows: Record<string, string>[],
  records: ChecklistMainRecord[]
): { mainResult: ChecklistTableResult; parents: ChecklistParent[] } {
  const mainResult = buildTableResult(mainTable, viewRows.map((viewRow, index) => records[index]?.row ?? viewRow))
  const parents: ChecklistParent[] = records.map((record, index) => {
    const error = record.row ? undefined : (record.error ?? "ReadRecord não retornou o registro.")
    return {
      key: mainResult.records[index].key,
      label: mainResult.records[index].label,
      primaryKey: record.primaryKey,
      ...(error ? { error } : {}),
    }
  })
  return { mainResult, parents }
}
