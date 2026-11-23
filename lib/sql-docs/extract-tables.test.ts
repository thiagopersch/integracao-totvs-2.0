import { describe, expect, it } from "vitest";
import { extractSql, stripCommentsAndStrings } from "./extract-tables";

describe("stripCommentsAndStrings", () => {
  it("removes comments and empties literals", () => {
    const out = stripCommentsAndStrings("SELECT 'FROM X' -- FROM Y\n/* JOIN Z */ FROM T");
    expect(out).not.toMatch(/X|Y|Z/);
    expect(out).toContain("FROM T");
  });
  it("handles escaped quotes", () => {
    expect(stripCommentsAndStrings("SELECT 'it''s' FROM T")).toBe("SELECT '' FROM T");
  });
});

describe("extractSql", () => {
  it("reads tables, aliases, joins and parameters", () => {
    const r = extractSql(`
      SELECT DISTINCT S.CODCURSO, ISNULL(C.MODALIDADE, 'P') AS MOD
      FROM SCURSO C (NOLOCK)
      INNER JOIN [dbo].[SHABILITACAOFILIAL] AS HF WITH (NOLOCK) ON HF.CODCURSO = C.CODCURSO
      LEFT JOIN SPSPROCESSOSELETIVO PS ON PS.CODCOLIGADA = C.CODCOLIGADA
      WHERE C.CODCOLIGADA = :CODCOLIGADA AND PS.IDPS = @IDPS AND X.Y = :$CODUSUARIO`);
    const names = r.tables.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["SCURSO", "SHABILITACAOFILIAL", "SPSPROCESSOSELETIVO"]));
    expect(r.tables.find((t) => t.name === "SHABILITACAOFILIAL")?.aliases).toEqual(["HF"]);
    expect(r.tables.find((t) => t.name === "SCURSO")?.aliases).toEqual(["C"]);
    expect(r.parameters).toEqual(expect.arrayContaining([":CODCOLIGADA", "@IDPS", ":$CODUSUARIO"]));
    expect(r.identifiers.has("MODALIDADE")).toBe(true);
  });

  it("skips CTEs, temp tables and subqueries", () => {
    const r = extractSql(`
      WITH BASE AS (SELECT * FROM GFILIAL F), OUTRA (A) AS (SELECT 1 A FROM GCOLIGADA)
      SELECT * FROM BASE B JOIN (SELECT * FROM SPREDIO) P ON 1 = 1 JOIN #TMP T ON 1 = 1`);
    const names = r.tables.map((t) => t.name).sort();
    expect(names).toEqual(["GCOLIGADA", "GFILIAL", "SPREDIO"]);
    expect(r.ctes).toEqual(["BASE", "OUTRA"]);
  });

  it("reads comma-separated FROM lists", () => {
    const r = extractSql("SELECT * FROM SALUNO A, PPESSOA P WHERE A.CODPESSOA = P.CODIGO");
    expect(r.tables.map((t) => t.name)).toEqual(["SALUNO", "PPESSOA"]);
    expect(r.tables[1].aliases).toEqual(["P"]);
  });

  it("does not mistake time literals or casts for parameters", () => {
    const r = extractSql("SELECT CAST('10:30' AS TIME), X::INT FROM T");
    expect(r.parameters).toEqual([]);
  });
});
