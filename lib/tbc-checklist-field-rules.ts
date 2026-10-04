import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"
import { formatChecklistValue } from "@/lib/tbc-checklist-values"

const INTEGER_TYPES = new Set(["short", "int", "integer", "long", "byte", "unsignedbyte", "unsignedshort", "unsignedint"])

/**
 * Integer fields whose 0 is a real option of the TOTVS screen (an enumeration), not "nothing
 * configured" — kept visible even when zero.
 */
const ZERO_IS_MEANINGFUL = new Set([
  "TIPOCONTABILLAN",
  "PAGPROF_TIPOCONTABILLAN",
  "TIPOCONTROLEVAGAS",
  "TIPOARQUIVO",
  "FASE",
  "TIPOESCOLHAGERARRA",
  "EXIBIRITINERARIO",
])

/** "Tipo de armazenamento" of the processo's files: 1 = database, anything else = file server. */
const FILE_STORAGE_DATABASE = "1"

function valueOf(fields: ChecklistFieldRow[], name: string): string {
  return fields.find((f) => f.name.toUpperCase() === name)?.valor.trim() ?? ""
}

/** Display value of a field, with the field-specific labels TOTVS shows on its screen. */
export function formatFieldValue(field: Pick<ChecklistFieldRow, "name" | "valor">): string {
  const value = field.valor.trim()
  if (field.name.toUpperCase() === "TIPOARQUIVO" && value !== "") {
    return value === FILE_STORAGE_DATABASE ? `${value} - Base de dados` : `${value} - Servidor de arquivos`
  }
  return formatChecklistValue(field.valor)
}

/**
 * Fields of one record worth a card:
 * - integers returned as 0 that mean "not configured" are dropped (PKs and enumerations whose 0 is
 *   a real option stay);
 * - "Pasta de armazenamento" only makes sense when the files go to a file server.
 * Missing/null values are kept — they are what "Não configurado" is for.
 */
export function visibleFields(fields: ChecklistFieldRow[]): ChecklistFieldRow[] {
  const storageType = valueOf(fields, "TIPOARQUIVO")
  return fields.filter((field) => {
    const name = field.name.toUpperCase()
    if (name === "DIRETORIOARQUIVO") return storageType !== "" && storageType !== FILE_STORAGE_DATABASE
    const isZeroInteger = INTEGER_TYPES.has(field.type.toLowerCase()) && field.valor.trim() === "0"
    return !isZeroInteger || field.isPrimaryKey || ZERO_IS_MEANINGFUL.has(name)
  })
}
