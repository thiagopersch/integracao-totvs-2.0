/**
 * TOTVS RM DataSet values as ReadRecord returns them: flags are always "T"/"F", dates are ISO
 * ("2026-08-01T00:00:00"), and null columns are simply omitted (arrive here as "").
 */

/** A field counts as configured when TOTVS returned a value for it — except an unchecked flag
 *  ("F"), which is how an empty checkbox on the RM screen comes back. "0" still counts. */
export function isConfiguredValue(value: string): boolean {
  const trimmed = value.trim()
  return trimmed !== "" && trimmed.toUpperCase() !== "F"
}

const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/

/** Human-readable value: T/F → Sim/Não, ISO date-time → dd/mm/aaaa (plus HH:mm when not
 *  midnight). Anything else is returned as-is. */
export function formatChecklistValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed === "T") return "Sim"
  if (trimmed === "F") return "Não"
  const date = ISO_DATE_TIME.exec(trimmed)
  if (date) {
    const [, year, month, day, hour, minute] = date
    const formatted = `${day}/${month}/${year}`
    return hour === "00" && minute === "00" ? formatted : `${formatted} ${hour}:${minute}`
  }
  return value
}
