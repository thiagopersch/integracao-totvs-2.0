import { describe, expect, it } from "vitest"
import { buildSaveRecordXml, parseDataServerRelations, parseDataServerRootName, type SchemaTable } from "./soap-schema"

const field = (name: string, isPrimaryKey = false) => ({
  name,
  caption: name,
  type: "string",
  defaultValue: "",
  maxLength: "",
  isPrimaryKey,
})

const TABLES: SchemaTable[] = [
  { name: "PSPROCESSO", fields: [field("CODCOLIGADA", true), field("IDPS", true), field("NOME")] },
  { name: "PSAREAINTERESSE", fields: [field("IDAREA", true), field("DESCRICAO")] },
]

describe("buildSaveRecordXml", () => {
  it("sends a single filled table bare, with only its filled fields", () => {
    const xml = buildSaveRecordXml(TABLES, { PSPROCESSO: { CODCOLIGADA: "1", IDPS: "", NOME: "Vestibular" } }, "EduPS")
    expect(xml).toBe("<PSPROCESSO>\n  <CODCOLIGADA>1</CODCOLIGADA>\n  <NOME>Vestibular</NOME>\n</PSPROCESSO>")
  })

  it("wraps two or more filled tables in the DataSet root", () => {
    const xml = buildSaveRecordXml(
      TABLES,
      { PSPROCESSO: { CODCOLIGADA: "1" }, PSAREAINTERESSE: { IDAREA: "7" } },
      "EduPS"
    )
    expect(xml).toBe(
      "<EduPS>\n  <PSPROCESSO>\n    <CODCOLIGADA>1</CODCOLIGADA>\n  </PSPROCESSO>\n  <PSAREAINTERESSE>\n    <IDAREA>7</IDAREA>\n  </PSAREAINTERESSE>\n</EduPS>"
    )
  })

  it("is empty when nothing is filled", () => {
    expect(buildSaveRecordXml(TABLES, { PSPROCESSO: { NOME: "" } }, "EduPS")).toBe("")
  })

  it("never sends read-only fields", () => {
    const tables: SchemaTable[] = [{ name: "T", fields: [field("A"), { ...field("B"), readOnly: true }] }]
    expect(buildSaveRecordXml(tables, { T: { A: "1", B: "2" } }, "DS")).toBe("<T>\n  <A>1</A>\n</T>")
  })

  it("escapes values", () => {
    expect(buildSaveRecordXml(TABLES, { PSPROCESSO: { NOME: "A & <B>" } }, "EduPS")).toContain(
      "<NOME>A &amp; &lt;B&gt;</NOME>"
    )
  })
})

describe("parseDataServerRootName", () => {
  it("reads the IsDataSet root element's name", () => {
    const xsd = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
      <xs:element name="EduPS" msdata:IsDataSet>
        <xs:complexType><xs:choice><xs:element name="PSPROCESSO"><xs:complexType><xs:sequence>
          <xs:element name="IDPS" type="xs:int" />
        </xs:sequence></xs:complexType></xs:element></xs:choice></xs:complexType>
      </xs:element>
    </xs:schema>`
    expect(parseDataServerRootName(xsd)).toBe("EduPS")
  })

  it("falls back to NewDataSet", () => {
    expect(parseDataServerRootName("<xs:schema xmlns:xs=\"x\"></xs:schema>")).toBe("NewDataSet")
  })
})

describe("parseDataServerRelations", () => {
  // Trimmed from EduPSAreaOfertadaData's live GetSchema: keyrefs name their parent's xs:unique.
  const xsd = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xs:element name="EduPSAreaOfertada" msdata:IsDataSet="true">
      <xs:unique name="Constraint1" msdata:PrimaryKey="true">
        <xs:selector xpath=".//SPSAreaOfertada" /><xs:field xpath="CODCOLIGADA" /><xs:field xpath="IDPS" /><xs:field xpath="IDAREAINTERESSE" />
      </xs:unique>
      <xs:unique name="SPSEtapaAreaOfertada_Constraint1" msdata:ConstraintName="Constraint1" msdata:PrimaryKey="true">
        <xs:selector xpath=".//mstns:SPSEtapaAreaOfertada" /><xs:field xpath="mstns:CODCOLIGADA" /><xs:field xpath="mstns:IDETAPA" />
      </xs:unique>
      <xs:keyref name="FK_SPSAreaOfertada_SPSEtapaAreaOfertada" refer="Constraint1">
        <xs:selector xpath=".//SPSEtapaAreaOfertada" /><xs:field xpath="CODCOLIGADA" /><xs:field xpath="IDPS" /><xs:field xpath="IDAREAINTERESSE" />
      </xs:keyref>
      <xs:keyref name="FK_Etapa_Horario" refer="mstns:SPSEtapaAreaOfertada_Constraint1">
        <xs:selector xpath=".//SPSHorarioEtapaAreaOfertada" /><xs:field xpath="CODCOLIGADA" /><xs:field xpath="ETAPA" />
      </xs:keyref>
      <xs:annotation><xs:appinfo>
        <msdata:Relationship name="Area_Idioma" msdata:parent="SPSAreaOfertada" msdata:child="SPSIdiomaAreaOfertada" msdata:parentkey="CODCOLIGADA IDPS" msdata:childkey="CODCOLIGADA IDPS" />
      </xs:appinfo></xs:annotation>
    </xs:element>
  </xs:schema>`

  it("resolves each keyref's parent through the constraint it refers to", () => {
    const relations = parseDataServerRelations(xsd)
    expect(relations).toContainEqual({
      name: "FK_SPSAreaOfertada_SPSEtapaAreaOfertada",
      parent: "SPSAreaOfertada",
      child: "SPSEtapaAreaOfertada",
      fields: [
        { parent: "CODCOLIGADA", child: "CODCOLIGADA" },
        { parent: "IDPS", child: "IDPS" },
        { parent: "IDAREAINTERESSE", child: "IDAREAINTERESSE" },
      ],
    })
    expect(relations.find((r) => r.child === "SPSHorarioEtapaAreaOfertada")).toMatchObject({
      parent: "SPSEtapaAreaOfertada",
      fields: [
        { parent: "CODCOLIGADA", child: "CODCOLIGADA" },
        { parent: "IDETAPA", child: "ETAPA" },
      ],
    })
  })

  it("reads msdata:Relationship annotations too", () => {
    expect(parseDataServerRelations(xsd).find((r) => r.child === "SPSIdiomaAreaOfertada")).toMatchObject({
      parent: "SPSAreaOfertada",
      fields: [
        { parent: "CODCOLIGADA", child: "CODCOLIGADA" },
        { parent: "IDPS", child: "IDPS" },
      ],
    })
  })

  it("is empty for a schema without relations", () => {
    expect(parseDataServerRelations("<xs:schema xmlns:xs=\"x\"></xs:schema>")).toEqual([])
  })
})
