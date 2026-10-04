/**
 * Maps a GetSchema field type to the input that only accepts what TOTVS accepts for it. Real
 * TOTVS DataSet XSDs (EduPSProcessoSeletivo/EduPSAreaOfertada) only use string/short/int/dateTime/
 * decimal/double/base64Binary — there's no xs:boolean: T/F flags are 1-char strings, recognisable
 * by a "T"/"F" default or a caption phrased as a question ("Ativo?"). Process GetSchema samples
 * (WCF DataContracts) do carry real `boolean`s, as "true"/"false".
 */
export type FieldInputKind =
  | "flag"
  | "boolean"
  | "integer"
  | "decimal"
  | "datetime"
  | "date"
  | "time"
  | "binary"
  | "text"
  | "longText"

export type FieldInputMeta = {
  type: string
  maxLength?: string
  defaultValue?: string
  caption?: string
}

const INTEGER_RANGES: Record<string, [number, number]> = {
  byte: [-128, 127],
  unsignedbyte: [0, 255],
  short: [-32768, 32767],
  unsignedshort: [0, 65535],
  int: [-2147483648, 2147483647],
  unsignedint: [0, 4294967295],
}
const INTEGER_TYPES = new Set([...Object.keys(INTEGER_RANGES), "long", "unsignedlong", "integer"])
const DECIMAL_TYPES = new Set(["decimal", "double", "float"])
const LONG_TEXT_THRESHOLD = 255

export function fieldInputKind({ type, maxLength, defaultValue, caption }: FieldInputMeta): FieldInputKind {
  const t = type.toLowerCase()
  if (INTEGER_TYPES.has(t)) return "integer"
  if (DECIMAL_TYPES.has(t)) return "decimal"
  if (t === "boolean") return "boolean"
  if (t === "datetime") return "datetime"
  if (t === "date") return "date"
  if (t === "time") return "time"
  if (t === "base64binary") return "binary"
  const max = Number(maxLength)
  if (max === 1 && (/^[TF]$/i.test(defaultValue ?? "") || (caption ?? "").trim().endsWith("?"))) return "flag"
  if (!maxLength || !Number.isFinite(max) || max > LONG_TEXT_THRESHOLD) return "longText"
  return "text"
}

/** Filters what's typed so the stored value is always in TOTVS's own format (decimals with "."). */
export function sanitizeFieldValue(kind: FieldInputKind, raw: string): string {
  if (kind === "integer") {
    const negative = raw.trimStart().startsWith("-")
    return `${negative ? "-" : ""}${raw.replace(/\D/g, "")}`
  }
  if (kind === "decimal") {
    const negative = raw.trimStart().startsWith("-")
    const [whole, ...rest] = raw.replace(/,/g, ".").replace(/[^\d.]/g, "").split(".")
    const fraction = rest.join("")
    return `${negative ? "-" : ""}${whole}${rest.length ? `.${fraction}` : ""}`
  }
  if (kind === "flag") return raw.toUpperCase().slice(0, 1)
  return raw
}

/** Validation message for a filled value, or null when it's acceptable (empty is always fine). */
export function fieldValueError(kind: FieldInputKind, type: string, value: string): string | null {
  if (value === "") return null
  if (kind === "integer") {
    if (!/^-?\d+$/.test(value)) return "Informe um número inteiro"
    const range = INTEGER_RANGES[type.toLowerCase()]
    const n = Number(value)
    if (range && (n < range[0] || n > range[1])) return `Valor deve estar entre ${range[0]} e ${range[1]}`
    return null
  }
  if (kind === "decimal") return /^-?\d+(\.\d+)?$/.test(value) ? null : "Informe um número decimal"
  if (kind === "flag") return /^[TF]$/.test(value) ? null : "Informe T ou F"
  if (kind === "boolean") return /^(true|false)$/.test(value) ? null : "Informe true ou false"
  return null
}

/** TOTVS dateTime ("2026-10-04T14:30:00", possibly with fraction/offset) → datetime-local value. */
export function toDateTimeInputValue(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/)
  return match ? `${match[1]}T${match[2]}${match[3] ?? ":00"}` : ""
}

/** datetime-local value ("2026-10-04T14:30" or with seconds) → TOTVS dateTime with seconds. */
export function fromDateTimeInputValue(value: string): string {
  if (!value) return ""
  return /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
}

/** TOTVS date/dateTime → date input value ("2026-10-04"). */
export function toDateInputValue(value: string): string {
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""
}
