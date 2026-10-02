import { describe, expect, it } from "vitest"
import {
  crossedThresholds,
  formatMonthLabel,
  monthForPeriod,
  pendingThresholds,
  periodKey,
  usageLevel,
  usagePercent,
} from "./contract-usage"

describe("contract usage thresholds", () => {
  it("computes the usage percentage", () => {
    expect(usagePercent(40, 50)).toBe(80)
    expect(usagePercent(42.5, 50)).toBe(85)
    expect(usagePercent(10, 0)).toBe(0)
  })

  it("lists every threshold reached, inclusive", () => {
    expect(crossedThresholds(79.99)).toEqual([])
    expect(crossedThresholds(80)).toEqual([80])
    expect(crossedThresholds(92)).toEqual([80, 85, 90])
    expect(crossedThresholds(100)).toEqual([80, 85, 90, 95, 100])
    expect(crossedThresholds(130)).toEqual([80, 85, 90, 95, 100])
  })

  it("only returns thresholds not alerted yet — a jump 70% → 92% yields 80/85/90 (alert sent for 90)", () => {
    const pending = pendingThresholds(92, [])
    expect(pending).toEqual([80, 85, 90])
    expect(Math.max(...pending)).toBe(90)
  })

  it("does not re-alert thresholds already sent in the month", () => {
    expect(pendingThresholds(86, [80, 85])).toEqual([])
    expect(pendingThresholds(96, [80, 85])).toEqual([90, 95])
  })

  it("maps percentages to usage levels", () => {
    expect(usageLevel(50)).toBe("ok")
    expect(usageLevel(80)).toBe("warning")
    expect(usageLevel(90)).toBe("critical")
    expect(usageLevel(100)).toBe("exceeded")
  })

  it("builds period keys and labels", () => {
    expect(periodKey({ year: 2026, month: 3 })).toBe("2026-03")
    expect(formatMonthLabel({ year: 2026, month: 10 })).toBe("outubro/2026")
    expect(monthForPeriod({ year: 2025 }, new Date(Date.UTC(2026, 9, 2)))).toEqual({ year: 2026, month: 10 })
    expect(monthForPeriod({ year: 2025, month: 4 })).toEqual({ year: 2025, month: 4 })
  })
})
