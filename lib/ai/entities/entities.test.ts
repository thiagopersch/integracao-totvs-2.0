import { describe, expect, it } from "vitest"
import { AI_ENTITIES, orderForCreation, parseOptionLabels, resolveRefs, validateRecord, type AiCatalogs, type AiRecordProposal } from "./index"

const catalogs: AiCatalogs = {
  clients: [{ id: "c1", name: "ITE - Toledo" }],
  analysts: [{ id: "a1", name: "João" }],
  requesters: [{ id: "r1", name: "Ana" }],
  departments: [{ id: "d1", name: "Secretaria" }],
  demandTypes: [{ id: "t1", name: "Suporte" }],
  contracts: [{ id: "k1", name: "40 h/mês", parentId: "c2" }],
  projects: [{ id: "p1", name: "PRJ-1 - Implantação", parentId: "c1" }],
  stages: [{ id: "s1", name: "A fazer", parentId: "p1" }],
  users: [{ id: "u1", name: "Maria" }],
}

const demand = {
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
  projectId: "",
}

const ctx = { catalogs, batch: [] }

describe("validateRecord — demand", () => {
  it("accepts a complete demand", () => {
    expect(validateRecord("demand", demand, ctx)).toEqual({})
  })

  it("flags missing catalog fields and inverted times", () => {
    const errors = validateRecord("demand", { ...demand, requesterId: "", endTime: "07:00" }, ctx)
    expect(Object.keys(errors).sort()).toEqual(["endTime", "requesterId"])
  })

  it("enforces the analyst scope of non-privileged users", () => {
    expect(validateRecord("demand", demand, { ...ctx, analystScope: "a2" }).analystId).toBeDefined()
    expect(validateRecord("demand", demand, { ...ctx, analystScope: "a1" })).toEqual({})
  })
})

describe("validateRecord — other entities", () => {
  it("validates a project with the default stages and settings", () => {
    expect(validateRecord("project", { name: "Implantação RM", clientId: "c1", status: "PLANNING", priority: "MEDIUM" }, ctx)).toEqual({})
  })

  it("rejects a contract of another client", () => {
    const errors = validateRecord("project", { name: "Implantação RM", clientId: "c1", contractId: "k1" }, ctx)
    expect(errors.contractId).toMatch(/não pertence/)
  })

  it("accepts a reference to a client created in the same batch", () => {
    const batch = [{ tempId: "r1", entity: "client" as const }]
    expect(validateRecord("project", { name: "Implantação RM", clientId: "@r1" }, { catalogs, batch })).toEqual({})
    // ...but not to a record of another type.
    expect(validateRecord("project", { name: "X", clientId: "@r1" }, { catalogs, batch: [{ tempId: "r1", entity: "tag" }] }).clientId).toBeDefined()
  })

  it("flags ids outside the catalogs", () => {
    expect(validateRecord("projectTask", { projectId: "nope", title: "Levantar requisitos" }, ctx).projectId).toMatch(/não encontrado/)
  })

  it("accepts a task without stage (the project's first stage is used)", () => {
    expect(validateRecord("projectTask", { projectId: "p1", title: "Levantar requisitos" }, ctx)).toEqual({})
  })

  it("requires options for selection properties", () => {
    const base = { label: "Fase", entity: "PROJECT", type: "SELECT", required: "false" }
    expect(validateRecord("customField", { ...base, options: "" }, ctx).options).toBeDefined()
    expect(validateRecord("customField", { ...base, options: "Alta, Média, Baixa" }, ctx)).toEqual({})
  })

  it("validates the simple catalogs with their own schemas", () => {
    expect(validateRecord("client", { name: "ACME" }, ctx)).toEqual({})
    expect(validateRecord("tag", { name: "ab" }, ctx).name).toBeDefined()
    expect(validateRecord("analyst", { name: "Carlos", email: "carlos@acme.com", level: "1" }, ctx).hourlyRate).toBeDefined()
  })
})

describe("batch helpers", () => {
  it("orders records after the ones they reference", () => {
    const records: Pick<AiRecordProposal, "tempId" | "entity" | "values">[] = [
      { tempId: "t", entity: "projectTask", values: { projectId: "@p", title: "x" } },
      { tempId: "p", entity: "project", values: { name: "y", clientId: "@c" } },
      { tempId: "c", entity: "client", values: { name: "z" } },
    ]
    expect(orderForCreation(records).map((r) => r.tempId)).toEqual(["c", "p", "t"])
  })

  it("replaces references by the created ids", () => {
    expect(resolveRefs("project", { name: "y", clientId: "@c" }, { c: "real-id" }).clientId).toBe("real-id")
    expect(resolveRefs("project", { name: "y", clientId: "@c" }, {}).clientId).toBe("@c")
  })

  it("parses option labels", () => {
    expect(parseOptionLabels("Alta, Média;Baixa,").map((o) => o.label)).toEqual(["Alta", "Média", "Baixa"])
  })

  it("every entity references only known catalogs and declares its title field", () => {
    for (const def of Object.values(AI_ENTITIES)) {
      expect(def.fields.some((f) => f.key === def.titleField)).toBe(true)
      for (const f of def.fields) if (f.kind === "ref") expect(f.ref).toBeTruthy()
    }
  })
})
