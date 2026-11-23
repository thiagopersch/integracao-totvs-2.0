import type { AiToolDefinition } from "@/lib/ai/types";
import type { SqlExtraction } from "./extract-tables";
import type { SqlDocEntry, SqlDocField, SqlDocTable } from "./types";

/** Dictionary slice sent with one query: the tables it reads and the columns it mentions. */
export interface DictionaryTable {
  table: string;
  description: string | null;
  columns: { column: string; description: string }[];
}

export const SQL_DOC_SYSTEM_PROMPT = `Você é um analista técnico de integrações TOTVS RM (SQL Server) e escreve a documentação funcional de sentenças SQL usadas na integração com o Rubeus.

Sua tarefa: ler UMA consulta SQL e descrever, em português do Brasil, como ela funciona, do que precisa e quais regras aplica — no padrão do documento "Mapeamento de consultas" (RB-34).

Regras de escrita (obrigatórias):
- Cada regra é UMA frase curta e completa, em linguagem de negócio, começando por um verbo: "Retorna somente…", "Considera somente…", "Recupera…", "Gera o código único combinando… no formato COLIGADA-TIPOCURSO", "Utiliza…", "Quando …, utiliza …; caso contrário, utiliza …", "Converte…", "Remove registros duplicados…", "Consolida…", "Padroniza…", "Recebe…".
- Não cite nomes técnicos de tabelas ou colunas (ex.: SPSPROCESSOSELETIVO, CODCOLIGADA) no texto das regras; use as descrições do dicionário como vocabulário (ex.: "coligada", "processo seletivo", "área de interesse ofertada", "período letivo", "filial", "prédio").
- Explique valores codificados quando o significado for dedutível pelo SQL, pelo dicionário ou pelo contexto (ex.: 'P' = Presencial, 'D' = EAD, 'S' = Semipresencial; status de integração 3 = Sucesso; ATIVO = 'S').
- Cubra, nesta ordem aproximada: o que a consulta retorna; parâmetros que recebe e como são usados; cada filtro relevante do WHERE/JOIN/EXISTS (vigência de datas, status ativo, vínculos obrigatórios); valores padrão (ISNULL/COALESCE/CASE); formatação/transformação de campos (concatenações, REPLACE, conversões, JSON); agrupamentos e remoção de duplicidade (DISTINCT/GROUP BY/STRING_AGG).
- Uma condição de INNER JOIN ou EXISTS que exige vínculo vira regra do tipo "Retorna somente … que possuam …".
- Não invente regras que não estejam no SQL. Não descreva a sintaxe SQL em si.
- Normalmente 3 a 12 regras; consultas grandes podem ter mais.

Exemplo de saída esperada (título e regras):
Título: "Cadastra/Atualiza nível de ensino"
- Retorna somente os níveis de ensino cadastrados para a coligada correspondente ao SENAI.
- Gera um código único combinando o código da coligada com o tipo do curso no formato COLIGADA-TIPOCURSO.
- Utiliza o nome cadastrado no tipo de curso como título do nível de ensino.
- Remove registros duplicados, garantindo uma lista padronizada para integração.

Título: "Cadastra/Atualiza local de oferta"
- Retorna os locais de oferta vinculados a turmas de processos seletivos ativos e cujo período de resultado ainda não tenha sido encerrado.
- Quando a turma possuir um prédio vinculado, utiliza os dados do prédio; caso contrário, utiliza os dados da filial como local de oferta.
- Remove caracteres de formatação do telefone e do CEP e retorna cidade e estado em uma estrutura JSON.

O título segue o padrão "Verbo/Verbo objeto" usado na integração (ex.: "Cadastra/Atualiza unidades", "Consulta inscrições do candidato"). Responda SEMPRE chamando a ferramenta document_sql_query.`;

const nullableString = { type: ["string", "null"] };

export const DOCUMENT_SQL_QUERY_TOOL: AiToolDefinition = {
  name: "document_sql_query",
  description: "Registra a documentação funcional de uma consulta SQL TOTVS RM.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "rules", "tables", "fields", "parameters"],
    properties: {
      title: { type: "string", description: "Título curto da consulta, ex.: 'Cadastra/Atualiza modalidades'." },
      summary: { type: "string", description: "Uma frase resumindo o objetivo da consulta." },
      rules: { type: "array", items: { type: "string" }, description: "Regras de funcionamento, uma frase por item." },
      tables: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "alias", "description", "role"],
          properties: {
            name: { type: "string", description: "Nome físico da tabela." },
            alias: nullableString,
            description: { ...nullableString, description: "Descrição da tabela (do dicionário quando houver)." },
            role: { type: "string", description: "Papel na consulta: principal, junção, junção opcional, subconsulta, existência…" },
          },
        },
      },
      fields: {
        type: "array",
        description: "Campos relevantes (retornados, filtros e junções).",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["table", "column", "description", "usage"],
          properties: {
            table: { type: "string" },
            column: { type: "string" },
            description: nullableString,
            usage: { type: "string", description: "Retorno, filtro, junção, ordenação ou agrupamento." },
          },
        },
      },
      parameters: {
        type: "array",
        description: "Parâmetros recebidos e o que representam, ex.: ':CODCOLIGADA — código da coligada'.",
        items: { type: "string" },
      },
    },
  },
};

export function buildUserMessage(input: { code: string; title: string; sql: string }, extraction: SqlExtraction, dictionary: DictionaryTable[]): string {
  const known = new Set(dictionary.map((d) => d.table));
  const dictText = dictionary.length
    ? dictionary
        .map((d) => {
          const cols = d.columns.map((c) => `  - ${c.column}: ${c.description}`).join("\n");
          return `${d.table}: ${d.description ?? "(sem descrição)"}${cols ? `\n${cols}` : ""}`;
        })
        .join("\n")
    : "(nenhuma tabela encontrada no dicionário)";
  const missing = extraction.tables.map((t) => t.name).filter((t) => !known.has(t));

  return [
    input.code ? `Código da consulta: ${input.code}` : "",
    input.title ? `Título informado pelo usuário (mantenha): ${input.title}` : "Título: sugira um no padrão da integração.",
    extraction.parameters.length ? `Parâmetros detectados: ${extraction.parameters.join(", ")}` : "",
    `Dicionário TOTVS das tabelas usadas (tabela: descrição; colunas citadas: descrição):\n${dictText}`,
    missing.length ? `Tabelas sem descrição no dicionário (deduza pelo nome/uso): ${missing.join(", ")}` : "",
    `Consulta SQL:\n\`\`\`sql\n${input.sql}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strOrNull = (v: unknown) => str(v) || null;

/** Turns the tool input into an entry, filling gaps from the dictionary and the user's input. */
export function toSqlDocEntry(
  raw: unknown,
  input: { id: string; code: string; title: string; sql: string },
  extraction: SqlExtraction,
  dictionary: DictionaryTable[]
): SqlDocEntry {
  const r = (raw ?? {}) as Record<string, unknown>;
  const dictByTable = new Map(dictionary.map((d) => [d.table, d]));
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  const tables: SqlDocTable[] = arr(r.tables)
    .map((t) => t as Record<string, unknown>)
    .map((t) => {
      const name = str(t.name).toUpperCase();
      return { name, alias: strOrNull(t.alias), description: strOrNull(t.description) ?? dictByTable.get(name)?.description ?? null, role: str(t.role) || "—" };
    })
    .filter((t) => t.name);
  // Tables the extractor saw but the model left out.
  for (const t of extraction.tables) {
    if (!tables.some((x) => x.name === t.name)) tables.push({ name: t.name, alias: t.aliases[0] ?? null, description: dictByTable.get(t.name)?.description ?? null, role: "—" });
  }

  const fields: SqlDocField[] = arr(r.fields)
    .map((f) => f as Record<string, unknown>)
    .map((f) => {
      const table = str(f.table).toUpperCase();
      const column = str(f.column).toUpperCase();
      const fromDict = dictByTable.get(table)?.columns.find((c) => c.column === column)?.description;
      return { table, column, description: fromDict ?? strOrNull(f.description), usage: str(f.usage) || "—" };
    })
    .filter((f) => f.column);

  const parameters = arr(r.parameters).map(str).filter(Boolean);
  for (const p of extraction.parameters) if (!parameters.some((x) => x.toUpperCase().startsWith(p))) parameters.push(p);

  return {
    id: input.id,
    code: input.code.trim(),
    title: input.title.trim() || str(r.title),
    summary: str(r.summary),
    rules: arr(r.rules).map(str).filter(Boolean),
    tables,
    fields,
    parameters,
    sql: input.sql,
  };
}
