import { describe, expect, it } from "vitest"
import { buildRecordGroups } from "./soap-request-fields"
import type { SchemaField, SchemaTable } from "@/utils/soap-schema"

const f = (name: string, extra: Partial<SchemaField> = {}): SchemaField => ({
  name,
  caption: name,
  type: "string",
  defaultValue: "",
  maxLength: "",
  isPrimaryKey: false,
  ...extra,
})

const TABLES: SchemaTable[] = [
  {
    name: "SPSProcessoSeletivo",
    fields: [f("CODCOLIGADA", { isPrimaryKey: true }), f("IDPS", { isPrimaryKey: true }), f("STATUS"), f("NOME"), f("CAMPONOVO")],
  },
  {
    name: "SPSFormaInscricaoPS",
    fields: [f("CODCOLIGADA", { isPrimaryKey: true }), f("IDPS", { isPrimaryKey: true }), f("IDFORMAINSCRICAO", { isPrimaryKey: true }), f("NOME")],
  },
]

const toItem = (table: string, field: SchemaField) => ({
  key: `${table}.${field.name}`,
  name: field.name,
  label: field.caption,
  meta: { type: field.type },
  value: "",
  onChange: () => {},
})

const keysOf = (groups: ReturnType<typeof buildRecordGroups>) =>
  groups.flatMap((g) => g.blocks.flatMap((b) => b.fields.map((field) => field.key)))

describe("buildRecordGroups", () => {
  it("follows the RM screen layout and lists every field exactly once, child keys included", () => {
    const groups = buildRecordGroups("eduPSProcessoSeletivoData", TABLES, toItem)
    const keys = keysOf(groups)
    expect(groups[0].title).toBe("Identificação")
    expect(keys).toHaveLength(9)
    expect(new Set(keys).size).toBe(9)
    expect(keys).toContain("SPSFormaInscricaoPS.IDFORMAINSCRICAO")
    expect(keys).toContain("SPSFormaInscricaoPS.CODCOLIGADA")
    expect(keys).toContain("SPSProcessoSeletivo.CAMPONOVO")
  })

  it("groups by table and key/required/optional/read-only without a layout", () => {
    const tables: SchemaTable[] = [
      { name: "T", fields: [f("ID", { isPrimaryKey: true }), f("A", { required: true }), f("B"), f("C", { readOnly: true })] },
    ]
    const [group] = buildRecordGroups("OutroData", tables, toItem)
    expect(group.blocks.map((b) => [b.title, b.fields.map((x) => x.name)])).toEqual([
      ["Chave primária", ["ID"]],
      ["Obrigatórios", ["A"]],
      ["Opcionais", ["B"]],
      ["Somente leitura", ["C"]],
    ])
  })
})
