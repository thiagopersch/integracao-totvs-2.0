import { DEFAULT_SQL_DOC_OPTIONS, entryHeading, type SqlDocOptions, type SqlDocument } from "./types";

/** Markdown of the "Mapeamento de consultas" document — ".md" download and the `text/plain`
 *  fallback of "Copiar para Google Docs". */

const cell = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, "<br>");

export function sqlDocToMarkdown(doc: SqlDocument, opts: SqlDocOptions = DEFAULT_SQL_DOC_OPTIONS): string {
  const out: string[] = [`# ${doc.title}`, ""];
  if (doc.subtitle) out.push(`\`${doc.subtitle}\``, "");

  for (const e of doc.entries) {
    out.push(`## ${entryHeading(e)}`, "");
    if (opts.includeSummary && e.summary) out.push(`_${e.summary}_`, "");
    out.push(...(e.rules.length ? e.rules.map((r) => `- ${r}`) : ["_Nenhuma regra registrada._"]), "");

    if (opts.includeTables) {
      if (e.parameters.length) out.push("**Parâmetros**", "", ...e.parameters.map((p) => `- ${p}`), "");
      if (e.tables.length) {
        out.push("**Tabelas utilizadas**", "", "| Tabela | Descrição | Papel na consulta |", "| --- | --- | --- |");
        for (const t of e.tables) out.push(`| \`${t.name}${t.alias ? ` (${t.alias})` : ""}\` | ${cell(t.description ?? "—")} | ${cell(t.role)} |`);
        out.push("");
      }
      if (e.fields.length) {
        out.push("**Campos utilizados**", "", "| Campo | Descrição | Uso |", "| --- | --- | --- |");
        for (const f of e.fields) out.push(`| \`${f.table ? `${f.table}.${f.column}` : f.column}\` | ${cell(f.description ?? "—")} | ${cell(f.usage)} |`);
        out.push("");
      }
    }
    if (opts.includeSql && e.sql.trim()) out.push("**Sentença SQL**", "", "```sql", e.sql.trim(), "```", "");
  }
  return out.join("\n");
}
