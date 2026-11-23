import { describe, expect, it } from "vitest";
import { extractSql } from "./extract-tables";
import { buildUserMessage, toSqlDocEntry, type DictionaryTable } from "./prompt";

const sql = "SELECT DISTINCT ISNULL(C.MODALIDADE, 'P') FROM SCURSO C JOIN SHABILITACAO H ON H.CODCURSO = C.CODCURSO WHERE C.CODCOLIGADA = :CODCOLIGADA";
const extraction = extractSql(sql);
const dictionary: DictionaryTable[] = [{ table: "SCURSO", description: "Cursos", columns: [{ column: "MODALIDADE", description: "Modalidade do curso" }] }];

describe("buildUserMessage", () => {
  it("sends the dictionary slice, missing tables, parameters and the SQL", () => {
    const msg = buildUserMessage({ code: "RB.PS.CAP.001", title: "", sql }, extraction, dictionary);
    expect(msg).toContain("SCURSO: Cursos");
    expect(msg).toContain("MODALIDADE: Modalidade do curso");
    expect(msg).toContain("Tabelas sem descrição no dicionário (deduza pelo nome/uso): SHABILITACAO");
    expect(msg).toContain(":CODCOLIGADA");
    expect(msg).toContain("sugira um");
    expect(msg).toContain(sql);
  });
});

describe("toSqlDocEntry", () => {
  it("keeps the user's code/title, fills descriptions from the dictionary and adds missed tables/params", () => {
    const entry = toSqlDocEntry(
      {
        title: "Cadastra/Atualiza modalidades",
        summary: "Lista modalidades.",
        rules: [" Remove registros duplicados. ", ""],
        tables: [{ name: "scurso", alias: "C", description: null, role: "principal" }],
        fields: [{ table: "SCURSO", column: "MODALIDADE", description: "x", usage: "Retorno" }],
        parameters: [],
      },
      { id: "1", code: "RB.PS.CAP.001", title: "Meu título", sql },
      extraction,
      dictionary
    );
    expect(entry.title).toBe("Meu título");
    expect(entry.rules).toEqual(["Remove registros duplicados."]);
    expect(entry.tables.map((t) => t.name)).toEqual(["SCURSO", "SHABILITACAO"]);
    expect(entry.tables[0].description).toBe("Cursos");
    expect(entry.fields[0].description).toBe("Modalidade do curso");
    expect(entry.parameters).toEqual([":CODCOLIGADA"]);
  });

  it("uses the AI title when the user left it blank", () => {
    const entry = toSqlDocEntry({ title: "Sugerido", rules: ["A."] }, { id: "1", code: "", title: "", sql }, extraction, []);
    expect(entry.title).toBe("Sugerido");
  });
});
