import { xmlToJson } from "@/utils/xml";

/** Mirrors services/soap.service.ts's decodeXmlEntities — duplicated (not imported) because that
 *  module pulls in server-only code (nodemailer via notification.service), which breaks the client
 *  bundle for this parser (used directly by tbc-reports-client.tsx). */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // must be last so "&amp;lt;" round-trips to literal "&lt;" text, not "<"
}

export type TbcReportListItem = {
  codColigada: number;
  /** TOTVS module display name (e.g. "TOTVS Educacional"), NOT the Sistema catalog's short code. */
  codSistema: string;
  /** Internal numeric report id — this is what `GetReportInfo`/`GenerateReport` expect as `idReport`. */
  codReport: string;
  /** Business-facing report code (e.g. "0002.1", "IND.03.02") — distinct from `codReport`. */
  codigo: string;
  nome: string;
  data: string;
  guid: string;
};

/** Generic — TOTVS's own field names for RptFilterReportPar/RptParameterReportPar aren't
 *  documented anywhere in this repo, so the dynamic filter/parameter form must render whatever
 *  keys show up here rather than assuming a fixed shape. */
export type RptReportPar = Record<string, unknown>;

export type GeneratedReportStatus = {
  status: "wait" | "done" | "error";
  resultGuid?: string;
  message?: string;
};

/**
 * `GetReportListResult` is a flat scalar string: repeating
 * `codColigada,codSistema,codReport,codigo,nome,data,guid;` groups — confirmed against a real
 * production response (see conversation) — with no escaping for a literal comma inside `nome`.
 * Records are separated by `;,` (semicolon THEN comma, also confirmed against a real response),
 * not a bare `;` — splitting on `;` alone leaves a stray leading empty token on every record but
 * the first, shifting every field over by one and silently corrupting almost the whole list.
 * Mitigation: anchor the 4 structurally-constrained fields from the front and the 2 from the back
 * (`data`/`guid`), then absorb any surplus middle segment into `nome` (report names essentially
 * never contain a literal comma, but this keeps the parse from silently dropping data if one does).
 */
export function parseReportListResponse(raw: string): TbcReportListItem[] {
  return raw
    .split(/;,?/)
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => {
      const tokens = group.split(",").map((t) => t.trim());
      if (tokens.length < 6) return null;

      const [codColigada, codSistema, codReport, codigo] = tokens;
      const guid = tokens[tokens.length - 1];
      const data = tokens[tokens.length - 2];
      const nome = tokens.slice(4, tokens.length - 2).join(",");

      return {
        codColigada: Number(codColigada) || 0,
        codSistema,
        codReport,
        codigo,
        nome,
        data,
        guid,
      };
    })
    .filter((item): item is TbcReportListItem => item !== null);
}

/** Coerces fast-xml-parser's single-item-collapses-to-object quirk back into an array. */
function toArray(value: unknown): RptReportPar[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value as RptReportPar[];
  return [value as RptReportPar];
}

/**
 * `GetReportInfoResult` (after `extractSoapResponse` already stripped the outer `<GetReportInfoResult>`
 * wrapper and ran one entity-decode pass) contains two sibling `<a:string>` elements — the standard
 * .NET `string[]` serialization — where EACH element's own inner content is itself a full nested XML
 * document (`ArrayOfRptFilterReportPar` / `ArrayOfRptParameterReportPar`) that fast-xml-parser does
 * NOT recursively parse. A second `xmlToJson` pass per string is required to get structured objects.
 */
export function parseReportInfoResponse(xmlResponse: string): { filters: RptReportPar[]; parameters: RptReportPar[] } {
  const matches = [...xmlResponse.matchAll(/<a:string[^>]*>([\s\S]*?)<\/a:string>/gi)].map((m) => m[1]);

  const [filtersRaw, parametersRaw] = matches;

  return {
    filters: filtersRaw ? parseArrayOfPar(filtersRaw, "RptFilterReportPar") : [],
    parameters: parametersRaw ? parseArrayOfPar(parametersRaw, "RptParameterReportPar") : [],
  };
}

function parseArrayOfPar(raw: string, itemTag: string): RptReportPar[] {
  const stripped = raw
    .trim()
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();

  if (!stripped) return [];

  // Defensive: this content is not double-encoded like GetSchema/ReadRecord's *Result (TOTVS
  // sends it as either CDATA-wrapped or single-layer XML), so decode is a no-op if already clean.
  const decoded = decodeXmlEntities(stripped);

  let parsed: Record<string, unknown>;
  try {
    parsed = xmlToJson(decoded);
  } catch {
    return [];
  }

  const arrayWrapperKey = Object.keys(parsed).find((k) => k.toLowerCase().startsWith("arrayof"));
  const wrapper = arrayWrapperKey ? (parsed[arrayWrapperKey] as Record<string, unknown> | undefined) : undefined;
  if (!wrapper || typeof wrapper !== "object") return [];

  return toArray(wrapper[itemTag]);
}

/** One editable `TABLE.COLUMN = value` condition found inside a filter's `Value`/`Filter` SQL
 *  text — see `extractFilterFields` for how these are mined out and kept in sync. */
export type FilterFieldEntry = {
  parIndex: number
  table: string
  column: string
  value: string
}

/** Matches one `TABLE.COLUMN = value` condition inside the free-form SQL text TOTVS puts in
 *  `RptFilterReportPar.Value` / `RptFilterByTablePar.Filter` (see the sample in the report-info
 *  response: conditions are joined with ` AND `, sometimes across newlines, and the whole `Value`
 *  is wrapped in one extra pair of parens). Lazy value capture + the lookahead below stop right
 *  before the next ` AND `, a trailing `)`, or end of string — so whitespace/newlines around the
 *  value are never swallowed into it. */
const FILTER_FIELD_PATTERN =
  /([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*?)(?=\s+AND\s|\s*\)?\s*$)/gi

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractFieldsFromText(text: string): { table: string; column: string; value: string }[] {
  return [...text.matchAll(FILTER_FIELD_PATTERN)].map((m) => ({
    table: m[1],
    column: m[2],
    value: m[3].trim(),
  }))
}

function replaceFieldValueInText(text: string, table: string, column: string, oldValue: string, newValue: string): string {
  const pattern = new RegExp(`(${escapeRegExp(table)}\\.${escapeRegExp(column)}\\s*=\\s*)${escapeRegExp(oldValue)}`, "i")
  return text.replace(pattern, (_match, prefix: string) => `${prefix}${newValue}`)
}

/** Normalizes `FiltersByTable.RptFilterByTablePar` — fast-xml-parser collapses a single entry to a
 *  bare object instead of a 1-item array (same quirk `toArray` above handles at the top level). */
function getFiltersByTableEntries(par: RptReportPar): RptReportPar[] {
  const filtersByTable = par["FiltersByTable"]
  if (!filtersByTable || typeof filtersByTable !== "object") return []
  return toArray((filtersByTable as Record<string, unknown>)["RptFilterByTablePar"])
}

/**
 * Mines every `TABLE.COLUMN = value` condition out of a report's filters — both the per-table
 * `FiltersByTable[].Filter` text and the combined top-level `Value` text, which repeat the same
 * conditions — so the UI can render one input per real field instead of one opaque textbox per
 * filter band. Deduped per report band (`parIndex`) since `Value` and `Filter` mirror each other.
 */
export function extractFilterFields(filters: RptReportPar[]): FilterFieldEntry[] {
  const result: FilterFieldEntry[] = []
  const seen = new Set<string>()

  filters.forEach((par, parIndex) => {
    const sources: string[] = []
    if (typeof par["Value"] === "string") sources.push(par["Value"] as string)
    for (const tableEntry of getFiltersByTableEntries(par)) {
      if (typeof tableEntry["Filter"] === "string") sources.push(tableEntry["Filter"] as string)
    }

    for (const source of sources) {
      for (const field of extractFieldsFromText(source)) {
        const key = `${parIndex}:${field.table}.${field.column}`.toUpperCase()
        if (seen.has(key)) continue
        seen.add(key)
        result.push({ parIndex, table: field.table, column: field.column, value: field.value })
      }
    }
  })

  return result
}

/**
 * Writes a new value for one `TABLE.COLUMN` condition back into both the `Value` text and every
 * matching `FiltersByTable[].Filter` text of the given filter band, keeping them in sync the same
 * way TOTVS sends them. Only the matched value token is replaced — surrounding formatting
 * (line breaks, `AND` joins, the outer parens) is left untouched.
 */
export function updateFilterFieldValue(
  filters: RptReportPar[],
  parIndex: number,
  table: string,
  column: string,
  oldValue: string,
  newValue: string
): RptReportPar[] {
  return filters.map((par, i) => {
    if (i !== parIndex) return par

    const next: RptReportPar = { ...par }
    if (typeof next["Value"] === "string") {
      next["Value"] = replaceFieldValueInText(next["Value"] as string, table, column, oldValue, newValue)
    }

    const filtersByTable = next["FiltersByTable"]
    if (filtersByTable && typeof filtersByTable === "object") {
      const container = { ...(filtersByTable as Record<string, unknown>) }
      const entries = container["RptFilterByTablePar"]
      const updateEntry = (entry: RptReportPar): RptReportPar =>
        typeof entry["Filter"] === "string"
          ? { ...entry, Filter: replaceFieldValueInText(entry["Filter"] as string, table, column, oldValue, newValue) }
          : entry

      if (Array.isArray(entries)) {
        container["RptFilterByTablePar"] = (entries as RptReportPar[]).map(updateEntry)
      } else if (entries && typeof entries === "object") {
        container["RptFilterByTablePar"] = updateEntry(entries as RptReportPar)
      }
      next["FiltersByTable"] = container
    }

    return next
  })
}

/**
 * `GetGeneratedReportStatusResult` is a scalar `"0;Wait"` / `"1;{guid}"` / `"2;Erro ..."` string.
 */
export function parseGeneratedReportStatus(raw: string): GeneratedReportStatus {
  const trimmed = raw.trim();
  const separatorIndex = trimmed.indexOf(";");
  const code = separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex);
  const rest = separatorIndex === -1 ? "" : trimmed.slice(separatorIndex + 1).trim();

  if (code === "1") return { status: "done", resultGuid: rest };
  if (code === "2") return { status: "error", message: rest || "Erro desconhecido ao gerar o relatório" };
  return { status: "wait" };
}
