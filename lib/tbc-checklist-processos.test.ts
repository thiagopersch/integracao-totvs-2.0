import { describe, expect, it } from "vitest"
import { findNameField, processoKey, toProcessoOptions } from "./tbc-checklist-processos"

const context = { coligate: 1, branch: 2, levelEducation: 3 }

describe("findNameField", () => {
  it("picks the first non-PK NOME/DESCRICAO field", () => {
    expect(
      findNameField([
        { name: "IDPS", isPrimaryKey: true },
        { name: "CODCOLIGADA", isPrimaryKey: true },
        { name: "NOME", isPrimaryKey: false },
        { name: "DESCRICAO", isPrimaryKey: false },
      ])
    ).toBe("NOME")
  })

  it("is undefined when no field looks like a name", () => {
    expect(findNameField([{ name: "IDPS", isPrimaryKey: true }])).toBeUndefined()
  })
})

describe("toProcessoOptions", () => {
  it("maps rows to processos with the search Contexto, newest IDPS first, deduped by coligada + IDPS", () => {
    const rows: Record<string, string>[] = [
      { CODCOLIGADA: "1", IDPS: "3", NOME: "Vestibular 2025" },
      { CodColigada: "1", idps: "12", Nome: " Vestibular 2026 " },
      { CODCOLIGADA: "1", IDPS: "3", NOME: "Duplicado" },
    ]
    expect(toProcessoOptions(rows, "NOME", context)).toEqual([
      { codColigada: 1, codFilial: 2, levelEducation: 3, idps: 12, name: "Vestibular 2026" },
      { codColigada: 1, codFilial: 2, levelEducation: 3, idps: 3, name: "Vestibular 2025" },
    ])
  })

  it("skips rows without a numeric key and names unnamed processos by IDPS", () => {
    const rows = [{ CODCOLIGADA: "1", IDPS: "" }, { CODCOLIGADA: "1", IDPS: "7" }]
    expect(toProcessoOptions(rows, undefined, context)).toEqual([
      { codColigada: 1, codFilial: 2, levelEducation: 3, idps: 7, name: "Processo seletivo 7" },
    ])
  })
})

describe("processoKey", () => {
  it("joins coligada and IDPS", () => {
    expect(processoKey({ codColigada: 1, idps: 7 })).toBe("1-7")
  })
})
