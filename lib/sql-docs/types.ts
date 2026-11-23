/** SQL query documentation (RB-34 "Mapeamento de consultas"). Plain types — shared by the client
 *  page, the API route and the renderers. */

export type SqlDocSource = "upload" | "paste" | "sentence";

/** One query as the user provided it. */
export interface SqlDocInput {
  id: string;
  source: SqlDocSource;
  fileName?: string;
  sentenceId?: string;
  /** e.g. "RB.PS.CAP.001" — empty means "let the AI suggest". */
  code: string;
  /** e.g. "Cadastra/Atualiza modalidades" — empty means "let the AI suggest". */
  title: string;
  sql: string;
}

export interface SqlDocTable {
  name: string;
  alias: string | null;
  description: string | null;
  /** How the query uses it: "principal", "junção", "subconsulta", "existência"… */
  role: string;
}

export interface SqlDocField {
  table: string;
  column: string;
  description: string | null;
  /** Retorno, filtro, junção, ordenação… */
  usage: string;
}

/** The analysed query — what each document section renders. */
export interface SqlDocEntry {
  id: string;
  code: string;
  title: string;
  summary: string;
  rules: string[];
  tables: SqlDocTable[];
  fields: SqlDocField[];
  parameters: string[];
  sql: string;
}

export interface SqlDocOptions {
  /** "Tabelas e campos utilizados" block under each query. */
  includeTables: boolean;
  /** The original SQL under each query. */
  includeSql: boolean;
  /** One-line summary above the rules. */
  includeSummary: boolean;
}

export const DEFAULT_SQL_DOC_OPTIONS: SqlDocOptions = { includeTables: false, includeSql: false, includeSummary: false };

export interface SqlDocument {
  title: string;
  subtitle: string;
  entries: SqlDocEntry[];
}

export const DEFAULT_SQL_DOC_TITLE = "Documentação técnica: Mapeamento de consultas";
export const DEFAULT_SQL_DOC_SUBTITLE = "Sentenças SQL | Integração TOTVS";

/** "CODE - Title", or whichever is filled. */
export function entryHeading(e: Pick<SqlDocEntry, "code" | "title">): string {
  return [e.code.trim(), e.title.trim()].filter(Boolean).join(" - ") || "Consulta";
}
