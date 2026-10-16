import { describe, expect, it } from "vitest"
import { validateProposal, type DemandProposalFields } from "./demand-proposal"

const base: DemandProposalFields = {
  name: "Ajuste no relatório",
  description: "Ajuste no relatório de matrícula",
  date: "2026-10-15",
  startTime: "08:00",
  endTime: "10:00",
  priority: "MEDIUM",
  status: "COMPLETED",
  notes: "",
  clientId: "c1",
  analystId: "a1",
  requesterId: "r1",
  departmentId: "d1",
  demandTypeId: "t1",
}

describe("validateProposal", () => {
  it("accepts a complete proposal", () => {
    expect(validateProposal(base)).toEqual({})
  })

  it("flags missing catalog fields and inverted times", () => {
    const errors = validateProposal({ ...base, requesterId: "", endTime: "07:00" })
    expect(Object.keys(errors).sort()).toEqual(["endTime", "requesterId"])
  })

  it("enforces the analyst scope of non-privileged users", () => {
    expect(validateProposal(base, "a2").analystId).toBeDefined()
    expect(validateProposal(base, "a1")).toEqual({})
  })
})
