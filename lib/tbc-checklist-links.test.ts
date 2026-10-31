import { describe, expect, it } from "vitest"
import type { ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
import { buildLinkFiltro } from "./tbc-checklist-filtro"
import { descendantsOf, linkableParents, linkFieldsLabel, linkTuples, suggestLinkFields } from "./tbc-checklist-links"

const col = (name: string, isPrimaryKey = false) => ({ name, isPrimaryKey })

describe("suggestLinkFields", () => {
  it("pairs the same-named columns that are a key on either side", () => {
    const areaOfertada = { fields: [col("CODCOLIGADA", true), col("IDPS", true), col("IDAREAINTERESSE", true), col("NOME"), col("CODFILIAL")] }
    const areaInteresse = { fields: [col("CODCOLIGADA", true), col("IDAREAINTERESSE", true), col("NOME"), col("CODFILIAL"), col("IDHABILITACAOFILIAL")] }
    expect(suggestLinkFields(areaOfertada, areaInteresse)).toEqual([
      { parent: "CODCOLIGADA", child: "CODCOLIGADA" },
      { parent: "IDAREAINTERESSE", child: "IDAREAINTERESSE" },
    ])
  })

  it("keeps each side's spelling and falls back to ID/COD columns when no key matches", () => {
    const parent = { fields: [col("idPessoa"), col("Nome"), col("CODUSUARIO", true)] }
    const child = { fields: [col("IDPESSOA"), col("NOME"), col("CODIGO", true)] }
    expect(suggestLinkFields(parent, child)).toEqual([{ parent: "idPessoa", child: "IDPESSOA" }])
  })
})

describe("cycles", () => {
  const graph = [
    { dataserverCode: "PS", links: [] },
    { dataserverCode: "AO", links: [{ parentCode: "PS", fields: [{ parent: "IDPS", child: "IDPS" }] }] },
    { dataserverCode: "AI", links: [{ parentCode: "AO", fields: [{ parent: "IDAREAINTERESSE", child: "IDAREAINTERESSE" }] }] },
    { dataserverCode: "DOC", links: [] },
  ]

  it("finds every Data Server that depends on one, directly or not", () => {
    expect([...descendantsOf(graph, "PS")].sort()).toEqual(["AI", "AO"])
    expect(descendantsOf(graph, "AI").size).toBe(0)
  })

  it("never offers itself or a dependent as parent", () => {
    expect(linkableParents(graph, "PS")).toEqual(["DOC"])
    expect(linkableParents(graph, "AI")).toEqual(["PS", "AO", "DOC"])
  })
})

describe("linkFieldsLabel", () => {
  it("names a pair once when both sides match", () => {
    expect(linkFieldsLabel([{ parent: "CODCOLIGADA", child: "CODCOLIGADA" }, { parent: "IDETAPA", child: "ETAPA" }])).toBe(
      "CODCOLIGADA, IDETAPA = ETAPA"
    )
  })
})

function result(rows: Record<string, string>[], empty = false): ChecklistTableResult {
  return {
    table: "SPSAreaOfertada",
    empty,
    records: rows.map((row, i) => ({
      key: `r${i}`,
      label: `r${i}`,
      fields: Object.entries(row).map(([name, valor]) => ({
        table: "SPSAreaOfertada",
        name,
        caption: name,
        isPrimaryKey: false,
        type: "int",
        configurado: true,
        valor,
      })),
    })),
  }
}

describe("linkTuples", () => {
  it("keeps distinct, complete tuples", () => {
    const rows = [
      { CODCOLIGADA: "1", IDAREAINTERESSE: "10" },
      { CODCOLIGADA: "1", IDAREAINTERESSE: " 10 " },
      { CODCOLIGADA: "1", IDAREAINTERESSE: "" },
      { CODCOLIGADA: "1", IDAREAINTERESSE: "11" },
    ]
    expect(linkTuples(result(rows), ["codcoligada", "IDAREAINTERESSE"])).toEqual([
      ["1", "10"],
      ["1", "11"],
    ])
  })

  it("gives nothing for a parent with no row", () => {
    expect(linkTuples(result([{ CODCOLIGADA: "", IDAREAINTERESSE: "" }], true), ["CODCOLIGADA"])).toEqual([])
  })
})

describe("buildLinkFiltro", () => {
  const fields = ["CODCOLIGADA", "IdAreaInteresse", "NOME"]

  it("writes one field as IN, with the schema's spelling", () => {
    expect(buildLinkFiltro("SPSAreaInteresse", fields, [{ fields: ["IDAREAINTERESSE"], tuples: [["10"], ["11"]] }])).toBe(
      "SPSAreaInteresse.IdAreaInteresse IN ('10', '11')"
    )
  })

  it("writes composite tuples as OR of ANDs, and links joined by AND", () => {
    expect(
      buildLinkFiltro("T", fields, [
        { fields: ["CODCOLIGADA", "IDAREAINTERESSE"], tuples: [["1", "10"], ["1", "11"]] },
        { fields: ["NOME"], tuples: [["D'Ávila"]] },
      ])
    ).toBe("((T.CODCOLIGADA = '1' AND T.IdAreaInteresse = '10') OR (T.CODCOLIGADA = '1' AND T.IdAreaInteresse = '11')) AND T.NOME IN ('D''Ávila')")
    expect(buildLinkFiltro("T", fields, [{ fields: ["CODCOLIGADA", "NOME"], tuples: [["1", "x"]] }])).toBe("(T.CODCOLIGADA = '1' AND T.NOME = 'x')")
  })

  it("fails on a field the main table no longer has", () => {
    expect(() => buildLinkFiltro("T", fields, [{ fields: ["IDPS"], tuples: [["1"]] }])).toThrow("O campo de vínculo IDPS não existe mais em T.")
  })
})
