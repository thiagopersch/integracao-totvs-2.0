import { describe, expect, it } from "vitest"
import {
  fieldInputKind,
  fieldValueError,
  fromDateTimeInputValue,
  sanitizeFieldValue,
  toDateTimeInputValue,
} from "./soap-field-input"
import { parseDataServerSchema } from "./soap-schema"

// Trimmed from a real EduPSProcessoSeletivo GetSchema response.
const XSD = `<EduPSProcessoSeletivo>
  <xs:schema id="EduPSProcessoSeletivo" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xs:element name="EduPSProcessoSeletivo" msdata:IsDataSet="true">
      <xs:complexType>
        <xs:choice minOccurs="0" maxOccurs="unbounded">
          <xs:element name="SPSProcessoSeletivo">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="CODCOLIGADA" msdata:Caption="Coligada do processo seletivo" type="xs:short" default="3" />
                <xs:element name="IDPS" msdata:Caption="Identificador do processo seletivo" type="xs:int" />
                <xs:element name="STATUS" msdata:Caption="Ativo?">
                  <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="1" /></xs:restriction></xs:simpleType>
                </xs:element>
                <xs:element name="ACEITATREINEIRO" msdata:Caption="Aceita treineiro" default="T">
                  <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="1" /></xs:restriction></xs:simpleType>
                </xs:element>
                <xs:element name="APLICACAO" msdata:Caption="Aplicação">
                  <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="1" /></xs:restriction></xs:simpleType>
                </xs:element>
                <xs:element name="NOME" msdata:Caption="Nome" minOccurs="0">
                  <xs:simpleType><xs:restriction base="xs:string"><xs:maxLength value="60" /></xs:restriction></xs:simpleType>
                </xs:element>
                <xs:element name="DTINIINSCRICAO" msdata:Caption="Início das inscrições" msdata:DateTimeMode="Unspecified" type="xs:dateTime" minOccurs="0" />
                <xs:element name="VALORINSCRICAO" msdata:Caption="Valor da inscrição" type="xs:decimal" minOccurs="0" />
                <xs:element name="ARQUIVOEDITAL" msdata:Caption="Edital" type="xs:base64Binary" minOccurs="0" />
                <xs:element name="CODEVENTOBAIXA" msdata:ReadOnly="true" msdata:Caption="Evento contábil de baixa" type="xs:short" minOccurs="0" />
              </xs:sequence>
            </xs:complexType>
          </xs:element>
        </xs:choice>
      </xs:complexType>
    </xs:element>
  </xs:schema>
</EduPSProcessoSeletivo>`

describe("fieldInputKind on a real schema", () => {
  const fields = Object.fromEntries(parseDataServerSchema(XSD)[0].fields.map((f) => [f.name, f]))
  const kindOf = (name: string) => fieldInputKind(fields[name])

  it("maps each TOTVS type to its input", () => {
    expect(kindOf("CODCOLIGADA")).toBe("integer")
    expect(kindOf("IDPS")).toBe("integer")
    expect(kindOf("STATUS")).toBe("flag")
    expect(kindOf("ACEITATREINEIRO")).toBe("flag")
    expect(kindOf("APLICACAO")).toBe("text")
    expect(kindOf("NOME")).toBe("text")
    expect(kindOf("DTINIINSCRICAO")).toBe("datetime")
    expect(kindOf("VALORINSCRICAO")).toBe("decimal")
    expect(kindOf("ARQUIVOEDITAL")).toBe("binary")
  })

  it("reads read-only and required flags", () => {
    expect(fields.CODEVENTOBAIXA.readOnly).toBe(true)
    expect(fields.IDPS.readOnly).toBe(false)
    expect(fields.IDPS.required).toBe(true)
    expect(fields.NOME.required).toBe(false)
  })

  it("treats strings without a max length as long text", () => {
    expect(fieldInputKind({ type: "string" })).toBe("longText")
    expect(fieldInputKind({ type: "string", maxLength: "4000" })).toBe("longText")
  })

  it("maps process booleans", () => {
    expect(fieldInputKind({ type: "boolean" })).toBe("boolean")
  })
})

describe("sanitizeFieldValue", () => {
  it("keeps only digits (and a leading minus) for integers", () => {
    expect(sanitizeFieldValue("integer", "12a3")).toBe("123")
    expect(sanitizeFieldValue("integer", "-4.5")).toBe("-45")
  })

  it("normalizes decimals to a single dot", () => {
    expect(sanitizeFieldValue("decimal", "1.234,50")).toBe("1.23450")
    expect(sanitizeFieldValue("decimal", "160,5")).toBe("160.5")
    expect(sanitizeFieldValue("decimal", "abc")).toBe("")
  })
})

describe("fieldValueError", () => {
  it("checks integer ranges per type", () => {
    expect(fieldValueError("integer", "short", "32767")).toBeNull()
    expect(fieldValueError("integer", "short", "40000")).toMatch(/entre/)
    expect(fieldValueError("integer", "int", "40000")).toBeNull()
  })

  it("accepts empty values", () => {
    expect(fieldValueError("decimal", "decimal", "")).toBeNull()
  })

  it("rejects malformed decimals and flags", () => {
    expect(fieldValueError("decimal", "decimal", "1.")).not.toBeNull()
    expect(fieldValueError("flag", "string", "X")).not.toBeNull()
  })
})

describe("dateTime conversion", () => {
  it("round-trips TOTVS dateTime and the datetime-local input", () => {
    expect(toDateTimeInputValue("2026-10-04T14:30:00")).toBe("2026-10-04T14:30:00")
    expect(toDateTimeInputValue("2026-10-04T14:30:00.000-03:00")).toBe("2026-10-04T14:30:00")
    expect(toDateTimeInputValue("")).toBe("")
    expect(fromDateTimeInputValue("2026-10-04T14:30")).toBe("2026-10-04T14:30:00")
    expect(fromDateTimeInputValue("2026-10-04T14:30:05")).toBe("2026-10-04T14:30:05")
  })
})
