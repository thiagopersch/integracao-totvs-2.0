import { describe, expect, it } from "vitest"
import type { AiCatalogs, AiEntityKey } from "@/lib/ai/entities"
import { buildSystemPrompt, toProposals } from "./ai-assistant.service"

const catalogs: AiCatalogs = {
  clients: [{ id: "c1", name: "ITE - Toledo" }],
  analysts: [{ id: "a1", name: "João" }],
  requesters: [{ id: "r1", name: "Ana" }],
  departments: [{ id: "d1", name: "Secretaria" }],
  demandTypes: [{ id: "t1", name: "Suporte" }],
  contracts: [],
  projects: [],
  users: [],
}
const entities: AiEntityKey[] = ["demand", "client", "project", "customField"]
const ctx = { entities, catalogs, defaultAnalystId: "a1" }

const fields = (o: Record<string, string | null>) => Object.entries(o).map(([key, value]) => ({ key, value }))

describe("toProposals", () => {
  it("applies defaults and keeps valid catalog ids", () => {
    const raw = {
      records: [
        {
          tempId: "r1",
          entity: "demand",
          fields: fields({
            clientId: "c1",
            requesterId: "r1",
            departmentId: "d1",
            demandTypeId: "t1",
            date: "2026-10-15",
            startTime: "8:00",
            endTime: "10:00",
            name: "Ajuste no relatório",
          }),
        },
      ],
    }
    const [first] = toProposals(raw, ctx)
    expect(first.values).toMatchObject({
      clientId: "c1",
      analystId: "a1",
      priority: "MEDIUM",
      status: "COMPLETED",
      startTime: "08:00",
      description: "Ajuste no relatório",
    })
    expect(first.errors).toEqual({})
  })

  it("drops ids outside the catalogs, unknown fields and malformed dates", () => {
    const raw = { records: [{ tempId: "r1", entity: "demand", fields: fields({ clientId: "invented", date: "15/10", foo: "bar", name: "xyz" }) }] }
    const [p] = toProposals(raw, ctx)
    expect(p.values.clientId).toBe("")
    expect(p.values.date).toBe("")
    expect(p.values).not.toHaveProperty("foo")
    expect(Object.keys(p.errors)).toEqual(expect.arrayContaining(["clientId", "date", "startTime"]))
  })

  it("links a project to a client created in the same batch", () => {
    const raw = {
      records: [
        { tempId: "c", entity: "client", fields: fields({ name: "ACME" }) },
        { tempId: "p", entity: "project", fields: fields({ name: "Implantação RM", clientId: "@c", status: "planejamento" }) },
      ],
    }
    const [client, project] = toProposals(raw, ctx)
    expect(client.errors).toEqual({})
    expect(project.values.clientId).toBe("@c")
    expect(project.values.status).toBe("PLANNING")
    expect(project.errors).toEqual({})
  })

  it("clears references to records missing from the batch or of the wrong type", () => {
    const raw = {
      records: [
        { tempId: "f", entity: "customField", fields: fields({ label: "Fase", entity: "PROJECT", type: "TEXT" }) },
        { tempId: "p", entity: "project", fields: fields({ name: "X", clientId: "@f", managerId: "@ghost" }) },
      ],
    }
    const [, project] = toProposals(raw, ctx)
    expect(project.values.clientId).toBe("")
    expect(project.values.managerId).toBe("")
  })

  it("ignores entities the user can't create and tolerates malformed output", () => {
    expect(toProposals({ records: [{ tempId: "x", entity: "tag", fields: fields({ name: "Urgente" }) }] }, ctx)).toEqual([])
    expect(toProposals(null, ctx)).toEqual([])
    expect(toProposals({ records: "nope" }, ctx)).toEqual([])
  })
})

describe("buildSystemPrompt", () => {
  it("lists only the allowed entities and their catalogs", () => {
    const prompt = buildSystemPrompt({
      entities: ["client", "project"],
      catalogs: { clients: catalogs.clients, contracts: [], users: [] },
      defaultAnalystId: null,
      demandDefaults: "",
      instructions: "Sempre em maiúsculas",
      now: new Date("2026-10-16T12:00:00Z"),
    })
    expect(prompt).toContain("(entity: project)")
    expect(prompt).not.toContain("(entity: demand)")
    expect(prompt).toContain("c1 | ITE - Toledo")
    expect(prompt).toContain("Sempre em maiúsculas")
    expect(prompt).toContain("HOJE: 2026-10-16")
  })
})
