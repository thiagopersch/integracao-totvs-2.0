import { describe, expect, it } from "vitest"
import type { ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
import { buildChecklistFiltro, buildLinkFiltro } from "./tbc-checklist-filtro"
import {
  contextValues,
  linkableParents,
  linkFieldsLabel,
  linkTuples,
  loadOrder,
  newOrderProblems,
  orderProblems,
  suggestLinkFields,
} from "./tbc-checklist-links"

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

describe("order", () => {
  const link = (parentCode: string) => ({ parentCode, fields: [{ parent: "ID", child: "ID" }] })
  const graph = [
    { dataserverCode: "PS", links: [] },
    { dataserverCode: "AO", links: [link("PS")] },
    { dataserverCode: "AI", links: [link("AO")] },
    { dataserverCode: "DOC", links: [] },
  ]
  const reorder = (codes: string[]) => codes.map((c) => graph.find((d) => d.dataserverCode === c)!)

  it("only offers the Data Servers above as parents", () => {
    expect(linkableParents(graph, "PS")).toEqual([])
    expect(linkableParents(graph, "AI")).toEqual(["PS", "AO"])
    expect(linkableParents(graph, "DOC")).toEqual(["PS", "AO", "AI"])
  })

  it("finds the links whose parent sits below the child", () => {
    expect(orderProblems(graph)).toEqual([])
    expect(orderProblems(reorder(["AO", "PS", "DOC", "AI"]))).toEqual([{ child: "AO", parent: "PS" }])
  })

  it("only blames a reorder for the problems it creates", () => {
    const legacy = reorder(["AO", "PS", "AI", "DOC"])
    expect(newOrderProblems(legacy, reorder(["AO", "PS", "DOC", "AI"]))).toEqual([])
    expect(newOrderProblems(legacy, reorder(["AI", "AO", "PS", "DOC"]))).toEqual([{ child: "AI", parent: "AO" }])
  })

  it("loads in the checklist's order, but never before a parent", () => {
    expect(loadOrder(graph).map((d) => d.dataserverCode)).toEqual(["PS", "AO", "AI", "DOC"])
    expect(loadOrder(reorder(["AI", "DOC", "AO", "PS"])).map((d) => d.dataserverCode)).toEqual(["DOC", "PS", "AO", "AI"])
    // A parent outside the entries (already on screen) doesn't hold anything back.
    expect(loadOrder(reorder(["AI"])).map((d) => d.dataserverCode)).toEqual(["AI"])
  })
})

describe("contextValues", () => {
  const pkValues = { CODCOLIGADA: "3", IDPS: "1152" }

  it("keeps the processo's values a same-named link pair also fills", () => {
    expect(contextValues(pkValues, [{ parentCode: "PS", fields: [{ parent: "CODCOLIGADA", child: "codcoligada" }] }])).toEqual(pkValues)
  })

  it("drops a column a link fills from a differently named parent column", () => {
    const links = [{ parentCode: "AI", fields: [{ parent: "CODCOLIGADAHABFILIAL", child: "CODCOLIGADA" }] }]
    expect(contextValues(pkValues, links)).toEqual({ IDPS: "1152" })
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

describe("buildChecklistFiltro", () => {
  const fields = ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE", "NOME"]
  const processo = { CODCOLIGADA: "3", IDPS: "1152" }
  const areas = { fields: ["IDAREAINTERESSE"], tuples: [["10"], ["11"]] }

  it("filters by the processo's values the table has", () => {
    expect(buildChecklistFiltro("T", ["CODCOLIGADA", "NOME"], processo, [])).toEqual({
      filtro: "T.CODCOLIGADA = '3'",
      appliedFilter: { CODCOLIGADA: "3" },
    })
  })

  it("filters by the links when the table has none of the processo's columns", () => {
    expect(buildChecklistFiltro("T", ["IDAREAINTERESSE"], processo, [areas]).filtro).toBe("T.IDAREAINTERESSE IN ('10', '11')")
  })

  it("adds the links to the processo's values", () => {
    expect(buildChecklistFiltro("T", fields, processo, [areas]).filtro).toBe(
      "T.CODCOLIGADA = '3' AND T.IDPS = '1152' AND T.IDAREAINTERESSE IN ('10', '11')"
    )
  })

  it("is empty with nothing to filter, and null when a link has no value", () => {
    expect(buildChecklistFiltro("T", ["NOME"], processo, []).filtro).toBe("")
    expect(buildChecklistFiltro("T", fields, processo, [{ fields: ["IDAREAINTERESSE"], tuples: [] }])).toEqual({
      filtro: null,
      appliedFilter: processo,
    })
  })
})
