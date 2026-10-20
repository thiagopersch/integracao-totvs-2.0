import { describe, expect, it } from "vitest"
import { auditRowsToSheetRows, classifyTotvsIntegration, pendingMessage } from "./totvs-field-audit"

describe("classifyTotvsIntegration", () => {
  it("is Configurado when table, field and alternative name are all filled", () => {
    const r = classifyTotvsIntegration({ totvs_table: "SMODALIDADE", totvs_field: "CODMODALIDADE", totvs_alternative_name: "CODMODALIDADE" })
    expect(r).toMatchObject({ status: "Configurado", tabela: "SMODALIDADE", campo: "CODMODALIDADE", nomeAlternativo: "CODMODALIDADE", faltando: [] })
    expect(pendingMessage(r)).toBe("")
  })

  it("is Incompleto and lists what is missing", () => {
    const r = classifyTotvsIntegration({ totvs_table: "SMODALIDADE", totvs_field: null })
    expect(r.status).toBe("Incompleto")
    expect(r.faltando).toEqual(["campo", "nome alternativo"])
    expect(pendingMessage(r)).toBe("Falta configurar: campo, nome alternativo")
  })

  it("is Não configurado when nothing is filled", () => {
    const r = classifyTotvsIntegration({})
    expect(r.status).toBe("Não configurado")
    expect(pendingMessage(r)).toMatch(/não configurada/)
  })

  it("treats whitespace-only strings as empty", () => {
    expect(classifyTotvsIntegration({ totvs_table: "  ", totvs_field: "", totvs_alternative_name: " " }).status).toBe("Não configurado")
  })

  it("accepts numeric values", () => {
    expect(classifyTotvsIntegration({ totvs_table: "T", totvs_field: 1, totvs_alternative_name: "A" }).campo).toBe("1")
  })
})

describe("auditRowsToSheetRows", () => {
  it("writes one row per field with the pending message", () => {
    const [row] = auditRowsToSheetRows([{ id: 7, nome: "Modalidade", tipo: "Select", ...classifyTotvsIntegration({}) }])
    expect(row["ID do campo"]).toBe(7)
    expect(row["Status"]).toBe("Não configurado")
    expect(row["Tabela TOTVS"]).toBe("")
  })
})
