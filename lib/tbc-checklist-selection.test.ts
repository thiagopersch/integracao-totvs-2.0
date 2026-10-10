import { describe, expect, it } from "vitest"
import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"
import type { LayoutTab } from "./tbc-checklist-layouts"
import type { SchemaField, SchemaTable } from "@/utils/soap-schema"
import {
  buildPickerTabs,
  checklistSelection,
  fieldKey,
  filterLayoutTabs,
  filterSelectedFields,
  hasSelectedField,
  toSelection,
} from "./tbc-checklist-selection"

function field(name: string, valor: string, type = "string", table = "SPSProcessoSeletivo"): ChecklistFieldRow {
  return { table, name, caption: name, isPrimaryKey: false, type, configurado: valor !== "", valor }
}

describe("toSelection / fieldKey", () => {
  it("matches table and field case-insensitively", () => {
    const selection = toSelection([{ table: "SPSProcessoSeletivo", name: "Nome" }])
    expect(selection.has(fieldKey("spsprocessoseletivo", "NOME"))).toBe(true)
    expect(hasSelectedField(selection, "SPSPROCESSOSELETIVO")).toBe(true)
    expect(hasSelectedField(selection, "SPSProcesso")).toBe(false)
  })
})

describe("filterLayoutTabs", () => {
  const tabs: LayoutTab[] = [
    {
      name: "Identificação",
      sections: [
        { title: "Identificação", table: "SPSProcessoSeletivo", fields: ["STATUS", "NOME", "IDPS"] },
        { title: "Inscrições", table: "SPSProcessoSeletivo", fields: ["VALORINSCRICAO"] },
      ],
    },
    { name: "Forma de inscrição", sections: [{ table: "SPSFormaInscricaoPS" }] },
    { name: "Campos", sections: [{ table: "SPSParamsCampos", view: "fieldMatrix" }] },
  ]

  it("keeps only selected fields and drops empty sections and tabs", () => {
    const selection = toSelection([
      { table: "SPSProcessoSeletivo", name: "nome" },
      { table: "SPSProcessoSeletivo", name: "IDPS" },
      { table: "SPSFormaInscricaoPS", name: "DESCRICAO" },
    ])
    expect(filterLayoutTabs(tabs, selection)).toEqual([
      { name: "Identificação", sections: [{ title: "Identificação", table: "SPSProcessoSeletivo", fields: ["NOME", "IDPS"] }] },
      { name: "Forma de inscrição", sections: [{ table: "SPSFormaInscricaoPS" }] },
    ])
  })

  it("returns no tab for an empty selection", () => {
    expect(filterLayoutTabs(tabs, new Set())).toEqual([])
  })
})

describe("filterSelectedFields", () => {
  it("keeps selected zeroed integers that visibleFields would hide", () => {
    const fields = [field("FASE", "0", "short"), field("LIMITEINSCRICOES", "0", "int"), field("NOME", "PS 2026")]
    const selection = toSelection([{ table: "SPSProcessoSeletivo", name: "LIMITEINSCRICOES" }, { table: "SPSProcessoSeletivo", name: "NOME" }])
    expect(filterSelectedFields(fields, selection).map((f) => f.name)).toEqual(["LIMITEINSCRICOES", "NOME"])
  })

  it("still hides the storage folder when files go to the database", () => {
    const selection = toSelection([{ table: "SPSProcessoSeletivo", name: "DIRETORIOARQUIVO" }])
    expect(filterSelectedFields([field("TIPOARQUIVO", "1"), field("DIRETORIOARQUIVO", "C:\\x")], selection)).toEqual([])
    expect(filterSelectedFields([field("TIPOARQUIVO", "2"), field("DIRETORIOARQUIVO", "C:\\x")], selection).map((f) => f.name)).toEqual([
      "DIRETORIOARQUIVO",
    ])
  })
})

describe("primary keys", () => {
  it("are dropped from the shown selection", () => {
    const tables = [{ name: "SPSProcessoSeletivo", fields: [{ name: "IDPS", isPrimaryKey: true }, { name: "NOME", isPrimaryKey: false }] }]
    const selection = checklistSelection(
      [
        { table: "SPSProcessoSeletivo", name: "IDPS" },
        { table: "SPSProcessoSeletivo", name: "NOME" },
      ],
      tables
    )
    expect([...selection]).toEqual([fieldKey("SPSProcessoSeletivo", "NOME")])
  })

  it("are never returned as cards", () => {
    const idps = { ...field("IDPS", "12"), isPrimaryKey: true }
    const selection = toSelection([{ table: "SPSProcessoSeletivo", name: "IDPS" }])
    expect(filterSelectedFields([idps], selection)).toEqual([])
  })
})

describe("buildPickerTabs", () => {
  const schemaField = (name: string, isPrimaryKey = false): SchemaField => ({
    name,
    caption: name,
    type: "string",
    defaultValue: "",
    maxLength: "",
    isPrimaryKey,
  })
  const table = (name: string, fields: SchemaField[]): SchemaTable => ({ name, fields })

  it("groups a laid-out Data Server by the TOTVS screen tabs", () => {
    const tables = [
      table("SPSPROCESSOSELETIVO", [schemaField("CODCOLIGADA", true), schemaField("IDPS", true), schemaField("NOME"), schemaField("STATUS"), schemaField("XPTO")]),
      table("SPSFormaInscricaoPS", [schemaField("IDPS", true), schemaField("DESCRICAO")]),
    ]
    const tabs = buildPickerTabs("EduPSProcessoSeletivoData", tables)
    const identificacao = tabs.find((t) => t.name === "Identificação")
    expect(identificacao?.sections[0]).toMatchObject({ title: "Identificação", table: "SPSPROCESSOSELETIVO" })
    // Layout order, only the names the schema has (casing resolved against it).
    expect(identificacao?.sections[0].fields.map((f) => f.name)).toEqual(["STATUS", "IDPS", "NOME"])
    // Fields no section lists aren't lost.
    const allNames = tabs.flatMap((t) => t.sections.flatMap((s) => s.fields.map((f) => `${s.table}.${f.name}`)))
    expect(allNames).toContain("SPSPROCESSOSELETIVO.XPTO")
    expect(allNames).toContain("SPSPROCESSOSELETIVO.CODCOLIGADA")
    expect(allNames).toContain("SPSFormaInscricaoPS.DESCRICAO")
  })

  it("uses one section per table without a layout", () => {
    const tables = [table("A", [schemaField("X")]), table("B", [schemaField("Y")])]
    expect(buildPickerTabs("FinCFODataBR", tables)).toEqual([
      {
        name: "Campos",
        sections: [
          { key: "A", title: "A", table: "A", fields: tables[0].fields },
          { key: "B", title: "B", table: "B", fields: tables[1].fields },
        ],
      },
    ])
  })
})
