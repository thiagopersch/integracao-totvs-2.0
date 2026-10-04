import { describe, expect, it } from "vitest"
import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"
import { formatFieldValue, visibleFields } from "./tbc-checklist-field-rules"

function field(name: string, valor: string, type = "string", isPrimaryKey = false): ChecklistFieldRow {
  return { table: "SPSProcessoSeletivo", name, caption: name, isPrimaryKey, type, configurado: valor !== "", valor }
}

const names = (fields: ChecklistFieldRow[]) => fields.map((f) => f.name)

describe("formatFieldValue", () => {
  it("labels the file storage type", () => {
    expect(formatFieldValue(field("TIPOARQUIVO", "1"))).toBe("1 - Base de dados")
    expect(formatFieldValue(field("TIPOARQUIVO", "2"))).toBe("2 - Servidor de arquivos")
  })

  it("falls back to the generic formatting", () => {
    expect(formatFieldValue(field("STATUS", "T"))).toBe("Sim")
  })
})

describe("visibleFields", () => {
  it("shows the storage folder only for a file server", () => {
    const folder = field("DIRETORIOARQUIVO", "")
    expect(names(visibleFields([field("TIPOARQUIVO", "1", "short"), folder]))).toEqual(["TIPOARQUIVO"])
    expect(names(visibleFields([field("TIPOARQUIVO", "2", "short"), folder]))).toEqual(["TIPOARQUIVO", "DIRETORIOARQUIVO"])
    expect(names(visibleFields([folder]))).toEqual([])
  })

  it("hides integers returned as 0, except keys and enumerations where 0 is an option", () => {
    const fields = [
      field("LIMITEINSCRICOES", "0", "short"),
      field("TAMANHOARQUIVO", "0", "int"),
      field("TAMANHOMAXIMOARQUIVO", "1024", "int"),
      field("TIPOCONTABILLAN", "0", "short"),
      field("CODCOLIGADA", "0", "short", true),
      field("VALORINSCRICAO", "0", "double"),
      field("CODINST", "", "int"),
    ]
    expect(names(visibleFields(fields))).toEqual([
      "TAMANHOMAXIMOARQUIVO",
      "TIPOCONTABILLAN",
      "CODCOLIGADA",
      "VALORINSCRICAO",
      "CODINST",
    ])
  })
})
