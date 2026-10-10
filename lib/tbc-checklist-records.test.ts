import { describe, expect, it } from "vitest"
import type { ChecklistTableMeta } from "@/actions/integrations/tbc-checklist"
import { assembleMainTable } from "./tbc-checklist-records"

const table: ChecklistTableMeta = {
  name: "SPSAreaOfertada",
  fields: [
    { name: "IDAREAOFERTADA", caption: "Id", isPrimaryKey: true, type: "int" },
    { name: "NOME", caption: "Nome", isPrimaryKey: false, type: "string" },
    { name: "VAGAS", caption: "Vagas", isPrimaryKey: false, type: "int" },
  ],
}

describe("assembleMainTable", () => {
  it("prefers the full ReadRecord row and falls back to the view row with the error", () => {
    const { mainResult, parents } = assembleMainTable(
      table,
      [
        { IDAREAOFERTADA: "1", NOME: "Área 1" },
        { IDAREAOFERTADA: "2", NOME: "Área 2" },
      ],
      [
        { primaryKey: "1;1", row: { IDAREAOFERTADA: "1", NOME: "Área 1", VAGAS: "30" } },
        { primaryKey: "1;2", row: null, error: "timeout" },
      ]
    )
    expect(mainResult.records.map((r) => r.fields.find((f) => f.name === "VAGAS")?.valor)).toEqual(["30", ""])
    expect(parents).toEqual([
      { key: "SPSAreaOfertada-0", label: "1 - Área 1", primaryKey: "1;1" },
      { key: "SPSAreaOfertada-1", label: "2 - Área 2", primaryKey: "1;2", error: "timeout" },
    ])
  })
})
