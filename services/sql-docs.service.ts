import { runAiToolCall } from "@/lib/ai";
import { extractSql } from "@/lib/sql-docs/extract-tables";
import { DOCUMENT_SQL_QUERY_TOOL, SQL_DOC_SYSTEM_PROMPT, buildUserMessage, toSqlDocEntry, type DictionaryTable } from "@/lib/sql-docs/prompt";
import type { SqlDocEntry } from "@/lib/sql-docs/types";
import { getDictionaryForTables } from "@/queries/sql-docs";
import type { AnalyzeSqlQueryInput } from "@/schemas/sql-docs.schema";
import { aiSettingsService } from "@/services/ai-settings.service";

/** Columns per table sent to the model — the ones the query mentions; tables with no match keep
 *  a few so the model still sees the vocabulary. */
function sliceDictionary(dictionary: DictionaryTable[], identifiers: Set<string>): DictionaryTable[] {
  return dictionary.map((d) => {
    const used = d.columns.filter((c) => identifiers.has(c.column));
    return { ...d, columns: used.length ? used : d.columns.slice(0, 15) };
  });
}

export const sqlDocsService = {
  async analyze(organizationId: string, input: AnalyzeSqlQueryInput, onDelta?: (chunk: string) => void): Promise<SqlDocEntry> {
    const config = await aiSettingsService.getClientConfig(organizationId);
    if (!config) throw new Error("O Assistente IA não está configurado ou está desativado — configure em Integrações > Assistente IA.");

    const extraction = extractSql(input.sql);
    const dictionary = sliceDictionary(await getDictionaryForTables(extraction.tables.map((t) => t.name)), extraction.identifiers);
    const system = config.instructions?.trim() ? `${SQL_DOC_SYSTEM_PROMPT}\n\nInstruções adicionais da organização:\n${config.instructions.trim()}` : SQL_DOC_SYSTEM_PROMPT;

    const result = await runAiToolCall(config, system, [{ role: "user", content: buildUserMessage(input, extraction, dictionary) }], DOCUMENT_SQL_QUERY_TOOL, onDelta);
    if (!result.toolInput) throw new Error(result.text?.trim() ? `A IA não devolveu a documentação: ${result.text.trim().slice(0, 300)}` : "A IA não devolveu a documentação — tente novamente.");

    const entry = toSqlDocEntry(result.toolInput, input, extraction, dictionary);
    if (entry.rules.length === 0) throw new Error("A IA não identificou regras nesta consulta — tente novamente.");
    return entry;
  },
};
