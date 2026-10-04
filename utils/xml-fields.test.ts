import { describe, expect, it } from "vitest"
import { listXmlLeafGroups, setXmlLeafValue } from "./xml-fields"

const PROCESS_XML = `<EduMatricPSData xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
  <CodColigada>1</CodColigada>
  <IdPS i:nil="true" />
  <Context>
    <_params>
      <KeyValueOfanyTypeanyType>
        <Key>$CODCOLIGADA</Key>
        <Value>1</Value>
      </KeyValueOfanyTypeanyType>
      <KeyValueOfanyTypeanyType>
        <Key>$CODUSUARIO</Key>
        <Value>mestre</Value>
      </KeyValueOfanyTypeanyType>
    </_params>
  </Context>
</EduMatricPSData>`

describe("listXmlLeafGroups", () => {
  it("groups leaves by parent element in document order", () => {
    const groups = listXmlLeafGroups(PROCESS_XML)
    expect(groups.map((g) => g.name)).toEqual(["EduMatricPSData", "_params"])
    expect(groups[0].fields.map((f) => [f.label, f.value])).toEqual([
      ["CodColigada", "1"],
      ["IdPS", ""],
    ])
  })

  it("labels KeyValue pairs by their Key and edits their Value", () => {
    const params = listXmlLeafGroups(PROCESS_XML)[1]
    expect(params.fields.map((f) => [f.label, f.value])).toEqual([
      ["$CODCOLIGADA", "1"],
      ["$CODUSUARIO", "mestre"],
    ])
  })

  it("returns nothing for invalid XML", () => {
    expect(listXmlLeafGroups("<a><b></a>")).toEqual([])
  })
})

describe("setXmlLeafValue", () => {
  it("writes a value back and keeps the rest of the document", () => {
    const field = listXmlLeafGroups(PROCESS_XML)[1].fields[1]
    const next = setXmlLeafValue(PROCESS_XML, field.path, "joao & cia")
    const params = listXmlLeafGroups(next)[1]
    expect(params.fields.map((f) => f.value)).toEqual(["1", "joao & cia"])
    expect(next).toContain("joao &amp; cia")
    expect(next).toContain("<CodColigada>1</CodColigada>")
  })

  it("drops the nil attribute once a value is filled", () => {
    const field = listXmlLeafGroups(PROCESS_XML)[0].fields[1]
    const next = setXmlLeafValue(PROCESS_XML, field.path, "42")
    expect(next).toContain("<IdPS>42</IdPS>")
    expect(next).not.toContain('i:nil="true"')
  })
})
