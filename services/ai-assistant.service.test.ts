import { describe, expect, it } from "vitest"
import { toProposals, type AssistantCatalogs } from "./ai-demand-assistant.service"

const catalogs: AssistantCatalogs = {
  clients: [{ id: "c1", name: "ITE - Toledo" }],
  analysts: [{ id: "a1", name: "João" }],
  requesters: [{ id: "r1", name: "Ana" }],
  departments: [{ id: "d1", name: "Secretaria" }],
  demandTypes: [{ id: "t1", name: "Suporte" }],
}

const raw = {
  demands: [
    {
      clientId: "c1",
      analystId: "a1",
      requesterId: "r1",
      departmentId: "d1",
      demandTypeId: "t1",
      date: "2026-10-15",
      startTime: "08:00",
      endTime: "10:00",
      name: "Ajuste no relatório",
      description: null,
      priority: null,
      status: null,
      notes: null,
    },
    { clientId: "invented-id", analystId: null, date: "15/10", name: "x" },
  ],
}

describe("toProposals", () => {
  it("applies defaults and keeps valid catalog ids", () => {
    const [first] = toProposals(raw, catalogs, undefined)
    expect(first).toMatchObject({ clientId: "c1", priority: "MEDIUM", status: "COMPLETED", description: "Ajuste no relatório" })
    expect(first.errors).toEqual({})
  })

  it("drops ids outside the catalogs and reports what is missing", () => {
    const [, second] = toProposals(raw, catalogs, undefined)
    expect(second.clientId).toBe("")
    expect(second.date).toBe("")
    expect(Object.keys(second.errors)).toEqual(expect.arrayContaining(["clientId", "analystId", "date", "startTime"]))
  })

  it("tolerates a missing or malformed tool output", () => {
    expect(toProposals(null, catalogs, undefined)).toEqual([])
    expect(toProposals({ demands: "nope" }, catalogs, undefined)).toEqual([])
  })
})
