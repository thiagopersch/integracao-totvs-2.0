import { describe, expect, it } from "vitest"
import type { SchemaField, SchemaRelation, SchemaTable } from "@/utils/soap-schema"
import type { PhysicalCatalog } from "./tbc-checklist-sql-sources"
import { buildChecklistSql, sqlIdentifier, type ChecklistSqlDataserver } from "./tbc-checklist-sql"

function field(name: string, caption: string, type = "string", extra: Partial<SchemaField> = {}): SchemaField {
  return { name, caption, type, defaultValue: "", maxLength: "", isPrimaryKey: false, ...extra }
}
const pk = (name: string, type = "int") => field(name, name, type, { isPrimaryKey: true })
const flag = (name: string, caption: string) => field(name, caption, "string", { maxLength: "1", defaultValue: "F" })

// Shapes trimmed from the live GetSchema of both Data Servers.
const PROCESSO_TABLES: SchemaTable[] = [
  {
    name: "SPSProcessoSeletivo",
    fields: [
      pk("CODCOLIGADA", "short"),
      pk("IDPS"),
      field("NOME", "Nome do processo seletivo"),
      flag("STATUS", "Ativo?"),
      field("NOMEINSTITUICAO", "Nome da instituição"),
      field("VALORINSCRICAO", "Valor da inscrição", "decimal"),
      field("ARQUIVOEDITAL", "Arquivo do edital", "base64Binary"),
      flag("LOGINCPF", "CPF"),
      field("TIPOARQUIVO", "Tipo de armazenamento", "short"),
      field("DIRETORIOARQUIVO", "Pasta de armazenamento"),
    ],
  },
  {
    name: "SPSFormaInscricaoPS",
    fields: [pk("CODCOLIGADA", "short"), pk("IDPS"), pk("IDFORMAINSCRICAO"), field("NOME", "Nome"), field("DATAINICIO", "Data início", "dateTime")],
  },
]

const AREA_TABLES: SchemaTable[] = [
  {
    name: "SPSAreaOfertada",
    fields: [pk("CODCOLIGADA", "short"), pk("IDPS"), pk("IDAREAINTERESSE"), flag("UTILIZAENEM", "Utiliza ENEM"), field("VALORINSCRICAO", "Valor da inscrição", "decimal")],
  },
  { name: "SPSEtapaAreaOfertada", fields: [pk("CODCOLIGADA", "short"), pk("IDPS"), pk("IDAREAINTERESSE"), pk("IDETAPA"), field("NOME", "Nome")] },
  // No IDPS/IDAREAINTERESSE of its own: reaches the área only through its etapa.
  { name: "SPSHorarioEtapaAreaOfertada", fields: [pk("CODCOLIGADA", "short"), pk("IDETAPA"), pk("IDHORARIO"), field("NOTAMINIMA", "Nota mínima", "decimal")] },
]

const rel = (parent: string, child: string, fields: string[]): SchemaRelation => ({
  name: `${parent}_${child}`,
  parent,
  child,
  fields: fields.map((f) => ({ parent: f, child: f })),
})

const CATALOG: PhysicalCatalog = {
  complete: true,
  tables: {
    SPSPROCESSOSELETIVO: ["CODCOLIGADA", "IDPS", "NOME", "STATUS", "VALORINSCRICAO", "ARQUIVOEDITAL"],
    SPSPARAMETROPS: ["CODCOLIGADA", "IDPS", "LOGINCPF", "TIPOARQUIVO", "DIRETORIOARQUIVO"],
    SPSFORMAINSCRICAOPS: ["CODCOLIGADA", "IDPS", "IDFORMAINSCRICAO", "NOME", "DATAINICIO"],
    SPSAREAOFERTADA: ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE", "UTILIZAENEM", "VALORINSCRICAO"],
    SPSETAPAAREAOFERTADA: ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE", "IDETAPA", "NOME"],
    SPSHORARIOETAPAAREAOFERTADA: ["CODCOLIGADA", "IDETAPA", "IDHORARIO", "NOTAMINIMA"],
  },
}

const picked = (table: string, ...names: string[]) => names.map((name) => ({ table, name }))

const DATASERVERS: ChecklistSqlDataserver[] = [
  {
    code: "EduPSProcessoSeletivoData",
    tables: PROCESSO_TABLES,
    relations: [rel("SPSProcessoSeletivo", "SPSFormaInscricaoPS", ["CODCOLIGADA", "IDPS"])],
    fields: [
      ...picked("SPSProcessoSeletivo", "IDPS", "STATUS", "NOMEINSTITUICAO", "VALORINSCRICAO", "ARQUIVOEDITAL", "LOGINCPF", "TIPOARQUIVO", "DIRETORIOARQUIVO"),
      ...picked("SPSFormaInscricaoPS", "NOME", "DATAINICIO"),
    ],
  },
  {
    code: "EduPSAreaOfertadaData",
    tables: AREA_TABLES,
    relations: [
      rel("SPSAreaOfertada", "SPSEtapaAreaOfertada", ["CODCOLIGADA", "IDPS", "IDAREAINTERESSE"]),
      rel("SPSEtapaAreaOfertada", "SPSHorarioEtapaAreaOfertada", ["CODCOLIGADA", "IDETAPA"]),
    ],
    fields: [...picked("SPSAreaOfertada", "UTILIZAENEM", "VALORINSCRICAO"), ...picked("SPSHorarioEtapaAreaOfertada", "NOTAMINIMA")],
  },
]

const result = buildChecklistSql({ checklistName: "Graduação", dataservers: DATASERVERS, catalog: CATALOG })
const sqlOf = (dialect: "oracle" | "sqlserver", code: string) => result.files[dialect].find((f) => f.code === code)!.sql

/** Column names of the final SELECT — what the Rubeus page reads. */
function finalAliases(sql: string): string[] {
  const select = sql.slice(sql.lastIndexOf("\nSELECT\n"), sql.lastIndexOf("\nFROM "))
  return [...select.matchAll(/(?:AS (\w+)|^ {4}\w+\.(\w+)),?$/gm)].map((m) => m[1] ?? m[2])
}

describe("buildChecklistSql", () => {
  it("writes the four RB.PS.VALIDA queries for each dialect", () => {
    for (const dialect of ["oracle", "sqlserver"] as const) {
      expect(result.files[dialect].map((f) => f.code)).toEqual(["RB.PS.VALIDA.1", "RB.PS.VALIDA.2", "RB.PS.VALIDA.3", "RB.PS.VALIDA.4"])
    }
    expect(result.files.sqlserver[0].fileName).toBe("RB.PS.VALIDA.1 - PROCESSO SELETIVO (SQL Server).sql")
  })

  it("keeps the processo/área key columns the page expects", () => {
    expect(finalAliases(sqlOf("oracle", "RB.PS.VALIDA.1")).slice(0, 3)).toEqual(["PROCESSO_SELETIVO", "CODCOLIGADA", "IDPS"])
    expect(finalAliases(sqlOf("oracle", "RB.PS.VALIDA.2")).slice(0, 4)).toEqual(["IDPS", "CODCOLIGADA", "IDAREAINTERESSE", "AREA_INTERESSE"])
  })

  it("names the details' columns exactly like the status queries", () => {
    expect(finalAliases(sqlOf("oracle", "RB.PS.VALIDA.3"))).toEqual(finalAliases(sqlOf("oracle", "RB.PS.VALIDA.1")))
    expect(finalAliases(sqlOf("sqlserver", "RB.PS.VALIDA.4"))).toEqual(finalAliases(sqlOf("sqlserver", "RB.PS.VALIDA.2")))
  })

  it("takes only the parameters of each query", () => {
    expect(sqlOf("oracle", "RB.PS.VALIDA.1")).not.toMatch(/:[A-Z]/)
    const area = sqlOf("oracle", "RB.PS.VALIDA.2")
    expect(area).toContain("SPSAREAOFERTADA.CODCOLIGADA = :CODCOLIGADA")
    expect(area).toContain("SPSAREAOFERTADA.IDPS = :IDPS")
    expect(area).not.toContain(":IDAREAINTERESSE")
    expect(sqlOf("oracle", "RB.PS.VALIDA.3")).toContain("SPSPROCESSOSELETIVO.IDPS = :IDPS")
    expect(sqlOf("oracle", "RB.PS.VALIDA.4")).toContain("SPSAREAOFERTADA.IDAREAINTERESSE = :IDAREAINTERESSE")
  })

  it("reads extension columns from their own table, joined by the processo key", () => {
    const sql = sqlOf("oracle", "RB.PS.VALIDA.1")
    expect(sql).toMatch(/PARAMETROPS AS \(\n {4}SELECT\n {8}SPSPARAMETROPS\.CODCOLIGADA,/)
    expect(sql).toContain("FROM SPSPARAMETROPS")
    expect(sql).toContain("LEFT JOIN PARAMETROPS ON PARAMETROPS.CODCOLIGADA = PROCESSOSELETIVO.CODCOLIGADA\n    AND PARAMETROPS.IDPS = PROCESSOSELETIVO.IDPS")
    expect(finalAliases(sql)).toContain("CPF")
  })

  it("leaves computed fields out, with a warning", () => {
    const sql = sqlOf("oracle", "RB.PS.VALIDA.1")
    expect(sql).not.toContain("SPSPROCESSOSELETIVO.NOMEINSTITUICAO")
    expect(sql).toContain(" *   - SPSProcessoSeletivo.NOMEINSTITUICAO (Nome da instituição) é calculado pelo TOTVS")
    expect(result.warnings.some((w) => w.includes("SPSProcessoSeletivo.NOMEINSTITUICAO"))).toBe(true)
  })

  it("never turns primary keys into checklist items", () => {
    expect(finalAliases(sqlOf("oracle", "RB.PS.VALIDA.1")).filter((a) => a === "IDPS")).toHaveLength(1)
  })

  it("aggregates child tables to one status per processo", () => {
    const sql = sqlOf("oracle", "RB.PS.VALIDA.1")
    expect(sql).toMatch(/FORMAINSCRICAOPS AS \([\s\S]*MAX\(\n\s+CASE\n\s+WHEN SPSFORMAINSCRICAOPS\.DATAINICIO IS NULL THEN NULL/)
    expect(sql).toContain("GROUP BY SPSFORMAINSCRICAOPS.CODCOLIGADA,\n        SPSFORMAINSCRICAOPS.IDPS")
  })

  it("joins up the XSD relations when a child table lacks the área key", () => {
    const sql = sqlOf("oracle", "RB.PS.VALIDA.2")
    expect(sql).toContain(
      "FROM SPSHORARIOETAPAAREAOFERTADA\n        INNER JOIN SPSETAPAAREAOFERTADA ON SPSETAPAAREAOFERTADA.CODCOLIGADA = SPSHORARIOETAPAAREAOFERTADA.CODCOLIGADA\n        AND SPSETAPAAREAOFERTADA.IDETAPA = SPSHORARIOETAPAAREAOFERTADA.IDETAPA"
    )
    expect(sql).toContain("GROUP BY SPSETAPAAREAOFERTADA.CODCOLIGADA,\n        SPSETAPAAREAOFERTADA.IDPS,\n        SPSETAPAAREAOFERTADA.IDAREAINTERESSE")
    expect(finalAliases(sql)).toContain("NOTA_MINIMA")
  })

  it("maps values to 'T' / 'F' / NULL by type", () => {
    const sql = sqlOf("oracle", "RB.PS.VALIDA.1")
    // flag: blank → NULL, F/N/0 → 'F'
    expect(sql).toContain("WHEN UPPER(SPSPROCESSOSELETIVO.STATUS) IN ('F', 'N', '0') THEN 'F'")
    // number: ≤ 0 → 'F'
    expect(sql).toContain("WHEN SPSPROCESSOSELETIVO.VALORINSCRICAO <= 0 THEN 'F'")
    // enumeration whose 0 is an option: any value counts
    expect(sql).not.toContain("SPSPARAMETROPS.TIPOARQUIVO <= 0")
    // folder only matters when files don't go to the database
    expect(sql).toContain("WHEN SPSPARAMETROPS.TIPOARQUIVO IS NULL OR SPSPARAMETROPS.TIPOARQUIVO = 1 THEN 'A'")
    expect(sql).toContain("CASE WHEN PARAMETROPS.PASTA_DE_ARMAZENAMENTO = 'A' THEN NULL ELSE PARAMETROPS.PASTA_DE_ARMAZENAMENTO END AS PASTA_DE_ARMAZENAMENTO")
  })

  it("writes each database's blank checks", () => {
    const oracle = sqlOf("oracle", "RB.PS.VALIDA.1")
    expect(oracle).toContain("NVL(LENGTH(TRIM(SPSPROCESSOSELETIVO.STATUS)), 0) = 0")
    expect(oracle).toContain("NVL(DBMS_LOB.GETLENGTH(SPSPROCESSOSELETIVO.ARQUIVOEDITAL), 0) = 0")
    const sqlserver = sqlOf("sqlserver", "RB.PS.VALIDA.1")
    expect(sqlserver).toContain("NULLIF(LTRIM(RTRIM(CAST(SPSPROCESSOSELETIVO.STATUS AS VARCHAR(MAX)))), '') IS NULL")
    expect(sqlserver).toContain("ISNULL(DATALENGTH(SPSPROCESSOSELETIVO.ARQUIVOEDITAL), 0) = 0")
    expect(sqlserver).not.toContain("NVL(")
  })

  it("details: NULL when ok, an ASCII-only HTML warning otherwise", () => {
    const sql = sqlOf("oracle", "RB.PS.VALIDA.3")
    expect(sql).toContain("WHEN PROCESSOSELETIVO.VALOR_DA_INSCRICAO = 'F' THEN '<div style=")
    expect(sql).toContain("Valor da inscri&#231;&#227;o: n&#227;o preenchido")
    // a date can't be "negative" — only the blank warning
    expect(sql).not.toContain("WHEN FORMAINSCRICAOPS.DATA_INICIO = 'F'")
    expect(sql).toContain("WHEN FORMAINSCRICAOPS.DATA_INICIO IS NULL THEN")
    const literals = [...sql.matchAll(/'(<div[^']*)'/g)].map((m) => m[1])
    expect(literals.length).toBeGreaterThan(0)
    expect(literals.every((l) => /^[ -~]*$/.test(l))).toBe(true)
  })

  it("dedupes aliases with the section name", () => {
    // SPSFormaInscricaoPS.NOME — "Nome" is taken by the driver's own NOME column.
    expect(finalAliases(sqlOf("oracle", "RB.PS.VALIDA.1"))).toContain("NOME_FORMA_DE_INSCRICAO")
  })

  it("keeps the joins in the header", () => {
    expect(sqlOf("oracle", "RB.PS.VALIDA.2")).toContain(" *   HORARIOETAPAAREAOFERTADA: SPSHORARIOETAPAAREAOFERTADA > SPSETAPAAREAOFERTADA por CODCOLIGADA, IDPS, IDAREAINTERESSE")
  })
})

describe("buildChecklistSql without a complete catalog", () => {
  it("assumes the DataSet table's own name, and says so", () => {
    const { files, warnings } = buildChecklistSql({
      checklistName: "X",
      dataservers: [DATASERVERS[0]],
      catalog: { complete: false, tables: { SPSPARAMETROPS: ["LOGINCPF"] } },
    })
    const sql = files.oracle[0].sql
    expect(sql).toContain("SPSPROCESSOSELETIVO.NOMEINSTITUICAO")
    expect(sql).toContain("SPSPARAMETROPS.LOGINCPF")
    expect(warnings.some((w) => w.startsWith("Tabelas fora do catálogo") && w.includes("SPSPROCESSOSELETIVO"))).toBe(true)
  })
})

describe("sqlIdentifier", () => {
  it("strips accents and punctuation", () => {
    expect(sqlIdentifier("Tipo de armazenamento")).toBe("TIPO_DE_ARMAZENAMENTO")
    expect(sqlIdentifier("Ativo?")).toBe("ATIVO")
    expect(sqlIdentifier("Área — Matrícula (Acadêmico)")).toBe("AREA_MATRICULA_ACADEMICO")
    expect(sqlIdentifier("1ª chamada")).toBe("C_1A_CHAMADA")
  })
})

describe("buildChecklistSql with Data Server links", () => {
  const same = (...names: string[]) => names.map((name) => ({ parent: name, child: name }))
  const AREA_INTERESSE: ChecklistSqlDataserver = {
    code: "EduPSAreaInteresseData",
    tables: [
      { name: "SPSAreaInteresse", fields: [pk("CODCOLIGADA", "short"), pk("IDAREAINTERESSE"), field("IDHABILITACAOFILIAL", "Habilitação", "int"), flag("ATIVO", "Ativo")] },
    ],
    relations: [],
    fields: picked("SPSAreaInteresse", "ATIVO"),
    links: [{ parentCode: "EduPSAreaOfertadaData", fields: same("CODCOLIGADA", "IDAREAINTERESSE") }],
  }
  const HABILITACAO: ChecklistSqlDataserver = {
    code: "EduHabilitacaoFilialData",
    tables: [{ name: "SHabilitacaoFilial", fields: [pk("CODCOLIGADA", "short"), pk("IDHABILITACAOFILIAL"), field("CODCURSO", "Curso")] }],
    relations: [],
    fields: picked("SHabilitacaoFilial", "CODCURSO"),
    links: [{ parentCode: "EduPSAreaInteresseData", fields: same("CODCOLIGADA", "IDHABILITACAOFILIAL") }],
  }
  const DOCUMENTO: ChecklistSqlDataserver = {
    code: "EduDocExigidosData",
    tables: [
      {
        name: "SDocExigidos",
        fields: [pk("CODCOLIGADA", "short"), pk("IDDOC"), field("IDHABILITACAOFILIAL", "Habilitação", "int"), field("IDAREAINTERESSE", "Área", "int"), flag("OBRIGATORIO", "Obrigatório")],
      },
    ],
    relations: [],
    fields: picked("SDocExigidos", "OBRIGATORIO"),
    links: [
      { parentCode: "EduHabilitacaoFilialData", fields: same("CODCOLIGADA", "IDHABILITACAOFILIAL") },
      { parentCode: "EduPSAreaOfertadaData", fields: same("CODCOLIGADA", "IDAREAINTERESSE") },
    ],
  }
  const LINKED_CATALOG: PhysicalCatalog = {
    complete: true,
    tables: {
      ...CATALOG.tables,
      SPSAREAINTERESSE: ["CODCOLIGADA", "IDAREAINTERESSE", "IDHABILITACAOFILIAL", "ATIVO"],
      SHABILITACAOFILIAL: ["CODCOLIGADA", "IDHABILITACAOFILIAL", "CODCURSO"],
      SDOCEXIGIDOS: ["CODCOLIGADA", "IDDOC", "IDHABILITACAOFILIAL", "IDAREAINTERESSE", "OBRIGATORIO"],
    },
  }
  const build = (dataservers: ChecklistSqlDataserver[]) => buildChecklistSql({ checklistName: "Graduação", dataservers, catalog: LINKED_CATALOG })
  const linked = build([...DATASERVERS, AREA_INTERESSE, HABILITACAO, DOCUMENTO])
  const area = (code: string) => linked.files.oracle.find((f) => f.code === code)!.sql

  it("reaches the área keys up the chain of links", () => {
    const sql = area("RB.PS.VALIDA.2")
    expect(sql).toContain(
      [
        "FROM SHABILITACAOFILIAL",
        "        INNER JOIN SPSAREAINTERESSE ON SPSAREAINTERESSE.CODCOLIGADA = SHABILITACAOFILIAL.CODCOLIGADA",
        "        AND SPSAREAINTERESSE.IDHABILITACAOFILIAL = SHABILITACAOFILIAL.IDHABILITACAOFILIAL",
        "        INNER JOIN SPSAREAOFERTADA ON SPSAREAOFERTADA.CODCOLIGADA = SPSAREAINTERESSE.CODCOLIGADA",
        "        AND SPSAREAOFERTADA.IDAREAINTERESSE = SPSAREAINTERESSE.IDAREAINTERESSE",
      ].join("\n")
    )
    expect(sql).toMatch(/CK_SHABILITACAOFILIAL AS \([\s\S]*GROUP BY SPSAREAOFERTADA\.CODCOLIGADA,\n {8}SPSAREAOFERTADA\.IDPS,\n {8}SPSAREAOFERTADA\.IDAREAINTERESSE/)
    expect(finalAliases(sql)).toEqual(expect.arrayContaining(["ATIVO", "CURSO", "OBRIGATORIO"]))
    expect(sql).toContain(" *   - EduHabilitacaoFilialData se liga pelos vínculos com EduPSAreaInteresseData > EduPSAreaOfertadaData.")
    // linked Data Servers belong to the área level only
    expect(finalAliases(area("RB.PS.VALIDA.1"))).not.toContain("CURSO")
  })

  it("filters the details by the área parameter on the anchor table", () => {
    expect(area("RB.PS.VALIDA.4")).toMatch(/CK_SHABILITACAOFILIAL AS \([\s\S]*WHERE SPSAREAOFERTADA\.CODCOLIGADA = :CODCOLIGADA\n {8}AND SPSAREAOFERTADA\.IDPS = :IDPS\n {8}AND SPSAREAOFERTADA\.IDAREAINTERESSE = :IDAREAINTERESSE/)
  })

  it("ties a second parent to the same keys, aliasing a table already joined", () => {
    const sql = area("RB.PS.VALIDA.2")
    // Área Ofertada is the shortest route, so it is the primary one.
    expect(sql).toContain("FROM SDOCEXIGIDOS\n        INNER JOIN SPSAREAOFERTADA ON SPSAREAOFERTADA.CODCOLIGADA = SDOCEXIGIDOS.CODCOLIGADA")
    expect(sql).toContain(
      [
        "        INNER JOIN SPSAREAOFERTADA SPSAREAOFERTADA_2 ON SPSAREAOFERTADA_2.CODCOLIGADA = SPSAREAINTERESSE.CODCOLIGADA",
        "        AND SPSAREAOFERTADA_2.IDAREAINTERESSE = SPSAREAINTERESSE.IDAREAINTERESSE",
        "        AND SPSAREAOFERTADA_2.CODCOLIGADA = SPSAREAOFERTADA.CODCOLIGADA",
        "        AND SPSAREAOFERTADA_2.IDPS = SPSAREAOFERTADA.IDPS",
        "        AND SPSAREAOFERTADA_2.IDAREAINTERESSE = SPSAREAOFERTADA.IDAREAINTERESSE",
      ].join("\n")
    )
  })

  it("ignores the links of a Data Server that has the processo keys itself", () => {
    const withLink = { ...DATASERVERS[1], links: [{ parentCode: "EduPSProcessoSeletivoData", fields: same("CODCOLIGADA", "IDPS") }] }
    const plain = build(DATASERVERS)
    expect(build([DATASERVERS[0], withLink]).files.oracle.map((f) => f.sql)).toEqual(plain.files.oracle.map((f) => f.sql))
  })

  it("leaves out a link whose fields aren't columns of the main tables", () => {
    const broken = { ...HABILITACAO, links: [{ parentCode: "EduPSAreaInteresseData", fields: same("CODCOLIGADA", "IDCURSO") }] }
    const { warnings } = build([...DATASERVERS, AREA_INTERESSE, broken])
    expect(warnings).toContain(
      "EduHabilitacaoFilialData: o vínculo com EduPSAreaInteresseData usa IDCURSO = IDCURSO, que não são colunas das tabelas principais — vínculo fora da SQL."
    )
    expect(warnings).toContain("EduHabilitacaoFilialData: nenhum vínculo leva às chaves do processo — ligado só por CODCOLIGADA.")
  })
})
