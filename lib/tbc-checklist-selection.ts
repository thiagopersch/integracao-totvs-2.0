import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"
import { buildLayoutTabs, CHECKLIST_LAYOUTS, type LayoutTab } from "@/lib/tbc-checklist-layouts"
import type { SchemaField, SchemaTable } from "@/utils/soap-schema"

/** Fields a saved checklist picked for one Data Server, as `fieldKey`s ("table.field", lowercased —
 *  GetSchema and ReadRecord don't always agree on casing). */
export type ChecklistSelection = ReadonlySet<string>

export function fieldKey(table: string, name: string): string {
  return `${table}.${name}`.toLowerCase()
}

export function toSelection(fields: { table: string; name: string }[]): ChecklistSelection {
  return new Set(fields.map((f) => fieldKey(f.table, f.name)))
}

/**
 * The selection a loaded Data Server is shown with: its saved fields minus the primary keys of
 * its schema. Keys only identify the record (always picked, never shown) — this also covers
 * checklists saved while keys were still stored with the fields.
 */
export function checklistSelection(
  fields: { table: string; name: string }[],
  tables: { name: string; fields: { name: string; isPrimaryKey: boolean }[] }[]
): ChecklistSelection {
  const primaryKeys = new Set(tables.flatMap((t) => t.fields.filter((f) => f.isPrimaryKey).map((f) => fieldKey(t.name, f.name))))
  return new Set([...toSelection(fields)].filter((key) => !primaryKeys.has(key)))
}

/** Whether any field of `table` is in the selection. */
export function hasSelectedField(selection: ChecklistSelection, table: string): boolean {
  const prefix = `${table.toLowerCase()}.`
  for (const key of selection) if (key.startsWith(prefix)) return true
  return false
}

/**
 * Narrows the screen layout (already resolved by `buildLayoutTabs`) to the selection: a section
 * listing fields keeps only the selected ones; a whole-table section (child-table rows, the
 * portal-field matrix) stays when its table has any field selected — its cards are filtered when
 * rendered. Sections and tabs left empty disappear.
 */
export function filterLayoutTabs(tabs: LayoutTab[], selection: ChecklistSelection): LayoutTab[] {
  return tabs
    .map((tab) => ({
      ...tab,
      sections: tab.sections.flatMap((section) => {
        if (!section.fields) return hasSelectedField(selection, section.table) ? [section] : []
        const fields = section.fields.filter((name) => selection.has(fieldKey(section.table, name)))
        return fields.length ? [{ ...section, fields }] : []
      }),
    }))
    .filter((tab) => tab.sections.length > 0)
}

/** "Tipo de armazenamento" of the processo's files: 1 = database, anything else = file server. */
const FILE_STORAGE_DATABASE = "1"

/**
 * The selected fields of one record, in record order. Unlike `visibleFields`, a zeroed integer is
 * still shown — the user picked it on purpose. Primary keys never are (they only identify the
 * record), and "Pasta de armazenamento" keeps its rule: it means nothing when the files are
 * stored in the database.
 */
export function filterSelectedFields(fields: ChecklistFieldRow[], selection: ChecklistSelection): ChecklistFieldRow[] {
  const storageType = fields.find((f) => f.name.toUpperCase() === "TIPOARQUIVO")?.valor.trim() ?? ""
  return fields.filter((field) => {
    if (field.isPrimaryKey || !selection.has(fieldKey(field.table, field.name))) return false
    if (field.name.toUpperCase() === "DIRETORIOARQUIVO") return storageType !== "" && storageType !== FILE_STORAGE_DATABASE
    return true
  })
}

/** One box of the field picker: a section of a TOTVS screen (or a whole table) and its fields. */
export type PickerSection = {
  key: string
  title: string
  table: string
  fields: SchemaField[]
}

/** One TOTVS screen tab of the field picker. */
export type PickerTab = {
  name: string
  sections: PickerSection[]
}

/**
 * Groups every GetSchema field of a Data Server the way the checklist shows it: Data Servers with
 * a screen layout (`CHECKLIST_LAYOUTS`) get the same tabs/sections as the TOTVS RM screen —
 * `buildLayoutTabs` already adds "Outros campos" and the unmapped tables, so no field is left out;
 * any other Data Server gets a single tab with one section per table. Field names are matched
 * case-insensitively and names the schema doesn't have are dropped.
 */
export function buildPickerTabs(dataserverCode: string, tables: SchemaTable[]): PickerTab[] {
  const layout = CHECKLIST_LAYOUTS[dataserverCode]
  const mainTable = tables[0]?.name
  if (!layout || !mainTable) {
    return [
      {
        name: "Campos",
        sections: tables.map((table) => ({ key: table.name, title: table.name, table: table.name, fields: table.fields })),
      },
    ]
  }

  return buildLayoutTabs(layout, tables, mainTable)
    .map((tab) => ({
      name: tab.name,
      sections: tab.sections.flatMap((section, index) => {
        const table = tables.find((t) => t.name.toLowerCase() === section.table.toLowerCase())
        if (!table) return []
        const fields = section.fields
          ? section.fields.flatMap((name) => table.fields.filter((f) => f.name.toLowerCase() === name.toLowerCase()))
          : table.fields
        return fields.length ? [{ key: `${tab.name}-${index}`, title: section.title ?? table.name, table: table.name, fields }] : []
      }),
    }))
    .filter((tab) => tab.sections.length > 0)
}
