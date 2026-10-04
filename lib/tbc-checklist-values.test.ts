import { describe, expect, it } from "vitest"
import { formatChecklistValue, isConfiguredValue } from "./tbc-checklist-values"

describe("isConfiguredValue", () => {
  it("treats missing values and unchecked flags as not configured", () => {
    expect(isConfiguredValue("")).toBe(false)
    expect(isConfiguredValue("   ")).toBe(false)
    expect(isConfiguredValue("F")).toBe(false)
    expect(isConfiguredValue("f")).toBe(false)
  })

  it("treats any other returned value as configured, zero included", () => {
    expect(isConfiguredValue("T")).toBe(true)
    expect(isConfiguredValue("0")).toBe(true)
    expect(isConfiguredValue("2026-08-01T00:00:00")).toBe(true)
    expect(isConfiguredValue("Online")).toBe(true)
  })
})

describe("formatChecklistValue", () => {
  it("maps flags to Sim/Não", () => {
    expect(formatChecklistValue("T")).toBe("Sim")
    expect(formatChecklistValue("F")).toBe("Não")
  })

  it("formats ISO dates, keeping the time only when it is not midnight", () => {
    expect(formatChecklistValue("2026-08-01T00:00:00")).toBe("01/08/2026")
    expect(formatChecklistValue("2026-12-31T23:59:00")).toBe("31/12/2026 23:59")
    expect(formatChecklistValue("2026-12-31T23:59:00-03:00")).toBe("31/12/2026 23:59")
  })

  it("returns other values unchanged", () => {
    expect(formatChecklistValue("0.0000")).toBe("0.0000")
    expect(formatChecklistValue("Online")).toBe("Online")
  })
})
