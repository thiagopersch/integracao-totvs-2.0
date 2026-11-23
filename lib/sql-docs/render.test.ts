import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "@/lib/ps-docs/types";
import { sqlDocToMarkdown } from "./export-sql-doc-markdown";
import { renderSqlDocFragment, renderSqlDocStandaloneHtml } from "./render-sql-doc-html";
import { DEFAULT_SQL_DOC_SUBTITLE, type SqlDocument } from "./types";

const doc: SqlDocument = {
  title: "[RB-34] Documentação técnica: Mapeamento de consultas",
  subtitle: DEFAULT_SQL_DOC_SUBTITLE,
  entries: [
    {
      id: "1",
      code: "RB.PS.CAP.001",
      title: "Cadastra/Atualiza modalidades",
      summary: "Lista as modalidades.",
      rules: ["Quando a modalidade não estiver informada, assume Presencial (P).", "Remove registros duplicados <b>."],
      tables: [{ name: "SCURSO", alias: "C", description: "Cursos", role: "principal" }],
      fields: [{ table: "SCURSO", column: "MODALIDADE", description: "Modalidade", usage: "Retorno" }],
      parameters: [":CODCOLIGADA"],
      sql: "SELECT DISTINCT MODALIDADE FROM SCURSO",
    },
  ],
};

describe("sql doc renderers", () => {
  it("renders the RB-34 structure: H2 'CODE - Title' and one bullet per rule, escaped", () => {
    const html = renderSqlDocFragment(doc, DEFAULT_STYLE);
    expect(html).toContain("RB.PS.CAP.001 - Cadastra/Atualiza modalidades</h2>");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("SCURSO");
  });

  it("adds tables, fields and SQL only when asked", () => {
    const html = renderSqlDocFragment(doc, DEFAULT_STYLE, { includeTables: true, includeSql: true, includeSummary: true });
    expect(html).toContain("Tabelas utilizadas");
    expect(html).toContain("SCURSO.MODALIDADE");
    expect(html).toContain("Sentença SQL");
    expect(html).toContain("Lista as modalidades.");
  });

  it("standalone page has the index and the editor", () => {
    const html = renderSqlDocStandaloneHtml(doc, DEFAULT_STYLE);
    expect(html).toContain('href="#q1-rb-ps-cap-001"');
    expect(html).toContain('id="q1-rb-ps-cap-001"');
    expect(html).toContain("data-editable-root");
  });

  it("markdown mirrors the structure", () => {
    const md = sqlDocToMarkdown(doc);
    expect(md).toContain("## RB.PS.CAP.001 - Cadastra/Atualiza modalidades");
    expect(md).toContain("- Remove registros duplicados <b>.");
  });
});
