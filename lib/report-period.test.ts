import { describe, expect, it } from "vitest"
import { resolveReportPeriod } from "./report-period"
import { computeNextReportRunAt } from "./report-schedule"

// 16/10/2026 10:00 in São Paulo (APP_TIME_ZONE, UTC-3).
const NOW = new Date("2026-10-16T13:00:00Z")

describe("resolveReportPeriod", () => {
  it("current month covers the whole month of the send date", () => {
    const p = resolveReportPeriod("currentMonth", NOW)
    expect(p.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z")
    expect(p.lt.toISOString()).toBe("2026-11-01T00:00:00.000Z")
    expect(p.label).toBe("outubro/2026")
    expect(p.startLabel).toBe("01/10/2026")
    expect(p.endLabel).toBe("31/10/2026")
    expect(p.slug).toBe("2026-10")
  })

  it("previous month crosses the year boundary", () => {
    const p = resolveReportPeriod("previousMonth", new Date("2026-01-10T12:00:00Z"))
    expect(p.gte.toISOString()).toBe("2025-12-01T00:00:00.000Z")
    expect(p.lt.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(p.slug).toBe("2025-12")
  })

  it("uses the São Paulo calendar day, not UTC", () => {
    // 01/11/2026 01:00 UTC is still 31/10 in São Paulo.
    const p = resolveReportPeriod("currentMonth", new Date("2026-11-01T01:00:00Z"))
    expect(p.slug).toBe("2026-10")
  })

  it("last 7 days includes today", () => {
    const p = resolveReportPeriod("last7days", NOW)
    expect(p.gte.toISOString()).toBe("2026-10-10T00:00:00.000Z")
    expect(p.lt.toISOString()).toBe("2026-10-17T00:00:00.000Z")
    expect(p.label).toBe("10/10/2026 a 16/10/2026")
  })
})

describe("computeNextReportRunAt", () => {
  it("monthly on a fixed day, later this month", () => {
    expect(computeNextReportRunAt("MONTHLY", NOW, "18:00", 20)?.toISOString()).toBe("2026-10-20T21:00:00.000Z")
  })

  it("monthly on a day already passed goes to next month", () => {
    expect(computeNextReportRunAt("MONTHLY", NOW, "08:00", 5)?.toISOString()).toBe("2026-11-05T11:00:00.000Z")
  })

  it("monthly on the last day (null) and day clamped to short months", () => {
    expect(computeNextReportRunAt("MONTHLY", NOW, "17:30", null)?.toISOString()).toBe("2026-10-31T20:30:00.000Z")
    const feb = new Date("2027-02-01T12:00:00Z")
    expect(computeNextReportRunAt("MONTHLY", feb, "08:00", 31)?.toISOString()).toBe("2027-02-28T11:00:00.000Z")
  })

  it("daily runs today when the time is still ahead, otherwise tomorrow", () => {
    expect(computeNextReportRunAt("DAILY", NOW, "18:00")?.toISOString()).toBe("2026-10-16T21:00:00.000Z")
    expect(computeNextReportRunAt("DAILY", NOW, "08:00")?.toISOString()).toBe("2026-10-17T11:00:00.000Z")
  })

  it("manual schedules never run on their own", () => {
    expect(computeNextReportRunAt("NONE", NOW, "08:00")).toBeNull()
  })
})
