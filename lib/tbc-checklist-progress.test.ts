import { describe, expect, it } from "vitest"
import { describeStep, progressPercent, type DataserverLoadProgress } from "./tbc-checklist-progress"

const item = (phase: DataserverLoadProgress["phase"], done = 0, total = 0): DataserverLoadProgress => ({
  code: "X",
  name: "X",
  phase,
  done,
  total,
})

describe("progressPercent", () => {
  it("weighs each Data Server the same and the view as 20% of it", () => {
    expect(progressPercent([item("waiting"), item("view")])).toBe(0)
    expect(progressPercent([item("records", 0, 10), item("waiting")])).toBe(10)
    expect(progressPercent([item("records", 5, 10), item("done")])).toBe(80)
    expect(progressPercent([item("done"), item("failed")])).toBe(100)
  })

  it("never goes back when a record count becomes known", () => {
    const steps = [
      [item("view"), item("waiting")],
      [item("records", 0, 1), item("waiting")],
      [item("done"), item("view")],
      [item("done"), item("records", 0, 40)],
      [item("done"), item("records", 4, 40)],
    ]
    const percents = steps.map(progressPercent)
    expect(percents).toEqual([...percents].sort((a, b) => a - b))
  })

  it("treats a view without records as complete records", () => {
    expect(progressPercent([item("records", 0, 0)])).toBe(100)
  })
})

describe("describeStep", () => {
  it("names the current step", () => {
    expect(describeStep(item("records", 8, 23))).toBe("Carregando registros 8 de 23…")
  })
})
