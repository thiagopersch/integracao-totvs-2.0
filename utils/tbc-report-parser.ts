import { xmlToJson } from "@/utils/xml";
import { decodeXmlEntities } from "@/services/soap.service";

export type TbcReportListItem = {
  codColigada: number;
  codSistema: string;
  codReport: string;
  nome: string;
  descricao: string;
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
 * `codColigada,codSistema,codReport,nome,descricao,data,guid;` groups, with no escaping for a
 * literal comma inside `nome`/`descricao`. Mitigation: anchor the 3 structurally-constrained
 * fields from the front and the 2 from the back (`data`/`guid`), then absorb any surplus middle
 * segment into `nome` (favoring the field the report picker actually searches/displays first),
 * treating the segment immediately before `data` as `descricao`.
 */
export function parseReportListResponse(raw: string): TbcReportListItem[] {
  return raw
    .split(";")
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => {
      const tokens = group.split(",").map((t) => t.trim());
      if (tokens.length < 5) return null;

      const [codColigada, codSistema, codReport] = tokens;
      const guid = tokens[tokens.length - 1];
      const data = tokens[tokens.length - 2];
      const middle = tokens.slice(3, tokens.length - 2);
      const descricao = middle.length ? middle[middle.length - 1] : "";
      const nome = middle.length > 1 ? middle.slice(0, -1).join(",") : middle[0] || "";

      return {
        codColigada: Number(codColigada) || 0,
        codSistema,
        codReport,
        nome,
        descricao,
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
