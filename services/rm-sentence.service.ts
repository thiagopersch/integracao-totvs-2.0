import { env } from "@/config/app.config";
import { soapService, cdata, type WsName } from "@/services/soap.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import type { SoapContext } from "@/utils/soap-envelope";
import type { Filter, Tbc, SoapMethod } from "@prisma/client";

export type RmSentenceRecord = {
  codeSentence: string;
  codColigada: string;
  codSystem: string;
  nameSentence: string;
  contentSentence: string;
  totvsUpdatedAt: Date | null;
  totvsUpdatedBy: string | null;
};

type FilterForFetch = Pick<
  Filter,
  | "filter"
  | "codColigadaSentenca"
  | "codSistemaSentenca"
  | "coligateContext"
  | "branchContext"
  | "levelEducationContext"
  | "codSystemContext"
  | "userContext"
>;

type TbcForRm = Pick<Tbc, "id" | "link" | "user" | "password" | "notRequiredLicense">;

/**
 * GConsSql's DataServerName — confirmed by the user against TOTVS's own published reference
 * (https://apitotvslegado.z15.web.core.windows.net/GlbConsSqlData.html?Objeto=GlbConsSqlData).
 * Primary key is CODCOLIGADA + APLICACAO + CODSENTENCA — APLICACAO is what this app calls
 * `codSystem` everywhere else (same convention already used by restoreSentenceToTbc below).
 */
const GLB_CONS_SQL_DATA = "GlbConsSqlData";

/**
 * The physical table GlbConsSqlData exposes — confirmed by the user: every field referenced in a
 * ReadView Filtro must be qualified with this table name (e.g. `GCONSSQL.CODSENTENCA`), or TOTVS
 * rejects the call. This is distinct from the DataServerName above (ws-level vs. table-level).
 */
const GCONSSQL_TABLE = "GCONSSQL";
const GCONSSQL_COLUMNS = [
  "CODCOLIGADA", "APLICACAO", "CODSENTENCA", "TITULO", "SENTENCA", "TAMANHO", "DISPONIVEL",
  "IDGRUPO", "NIVEL", "DTULTALTERACAO", "USRULTALTERACAO", "DISPONIVELFILTRO",
  "DISPONIVELRELATORIO", "DISPONIVELVISAO", "NOMEFANTASIA", "IDDBCONNECTION",
  "PODEALTERAR", "PODEEXCLUIR", "DISPONIVELMENU", "SEMSEGCOLUNAS", "SEMSEGESTENDIDA",
  "GUID", "VERSAO", "CONTROLE", "NOMESISTEMA",
];

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeFilterLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** Prefixes every bare GConsSql column reference in a filter expression with `GCONSSQL.` — skips
 *  references already qualified, so this is safe to run on the whole assembled Filtro at once. */
function qualifyGConsSqlColumns(expression: string): string {
  return GCONSSQL_COLUMNS.reduce(
    (expr, column) => expr.replace(new RegExp(`(?<![\\w.])${column}\\b`, "gi"), `${GCONSSQL_TABLE}.${column}`),
    expression
  );
}

/** filter.filter is already a native RM filter expression (e.g. `CODSENTENCA LIKE 'ABC%'`) — it's
 *  sent to TOTVS as-is, just ANDed with the Filtro's own coligada/sistema scoping, and every column
 *  reference is qualified with the GCONSSQL table name TOTVS requires for ReadView. */
function buildViewFiltro(filter: FilterForFetch): string {
  const parts = [`(${filter.filter})`];
  if (filter.codColigadaSentenca) parts.push(`CODCOLIGADA=${filter.codColigadaSentenca}`);
  if (filter.codSistemaSentenca) parts.push(`APLICACAO='${escapeFilterLiteral(filter.codSistemaSentenca)}'`);
  return qualifyGConsSqlColumns(parts.join(" AND "));
}

function looksLikeConsSqlRow(node: unknown): node is Record<string, unknown> {
  return !!node && typeof node === "object" && "CODSENTENCA" in (node as Record<string, unknown>);
}

/**
 * ReadViewResult is XML-as-string; the row collection can be nested at any depth in the parsed
 * tree, and a single matching row commonly serializes as a bare object instead of a 1-item array
 * (a well-known fast-xml-parser/.NET XML serialization quirk) — so this walks the tree looking
 * for whatever "looks like" a GConsSql row instead of assuming one fixed wrapper shape.
 */
function extractConsSqlRows(jsonResponse: Record<string, unknown>): Record<string, unknown>[] {
  const visited = new Set<unknown>();

  function walk(node: unknown): Record<string, unknown>[] | null {
    if (!node || typeof node !== "object" || visited.has(node)) return null;
    visited.add(node);

    if (Array.isArray(node)) {
      const rows = node.filter(looksLikeConsSqlRow);
      if (rows.length > 0) return rows;
      for (const item of node) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }

    if (looksLikeConsSqlRow(node)) return [node];

    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = walk(value);
      if (found) return found;
    }
    return null;
  }

  return walk(jsonResponse) ?? [];
}

function parseTotvsDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Live read of GlbConsSqlData (wsDataServer.ReadView) scoped by the Filtro's own expression + coligada/sistema. */
async function fetchSentencesFromTotvs(
  filter: FilterForFetch,
  tbc: TbcForRm,
  organizationId: string
): Promise<RmSentenceRecord[]> {
  const endpointType = await soapEndpointService.getActiveTypeByKey("dataserver");
  const endpointMethod = await soapEndpointService.getActiveMethodByKey(endpointType.id, "READVIEW");

  const filtro = buildViewFiltro(filter);
  const methodXml = `<ReadView>
  <DataServerName>${escapeXml(GLB_CONS_SQL_DATA)}</DataServerName>
  <Filtro>${escapeXml(filtro)}</Filtro>
</ReadView>`;

  const result = await soapService.execute(
    {
      tbc: {
        id: tbc.id,
        link: tbc.link,
        user: tbc.user,
        password: tbc.password,
        notRequiredLicense: tbc.notRequiredLicense,
      },
      wsName: endpointType.suffix as WsName,
      method: endpointMethod.method as SoapMethod,
      xml: methodXml,
      context: {
        coligate: filter.coligateContext,
        branch: filter.branchContext,
        levelEducation: filter.levelEducationContext,
        codSystem: filter.codSystemContext,
        user: filter.userContext,
      },
    },
    organizationId
  );

  const rows = extractConsSqlRows(result.jsonResponse);

  return rows.map((row) => ({
    codeSentence: String(row.CODSENTENCA ?? ""),
    codColigada: String(row.CODCOLIGADA ?? filter.codColigadaSentenca),
    codSystem: String(row.APLICACAO ?? filter.codSistemaSentenca),
    nameSentence: String(row.TITULO ?? row.CODSENTENCA ?? ""),
    contentSentence: String(row.SENTENCA ?? ""),
    totvsUpdatedAt: parseTotvsDate(row.DTULTALTERACAO),
    totvsUpdatedBy: row.USRULTALTERACAO != null ? String(row.USRULTALTERACAO) : null,
  }));
}

/**
 * "Realizar Backup" always does the live read — that's the entire point of a backup — and its
 * result is what gets persisted into `backups` below; nothing else re-reads TOTVS afterwards.
 */
export async function fetchSentencesForFilter(
  filter: FilterForFetch,
  tbc: TbcForRm,
  organizationId: string
): Promise<RmSentenceRecord[]> {
  return fetchSentencesFromTotvs(filter, tbc, organizationId);
}

/**
 * Looks up ONE sentence by its exact primary key (CODCOLIGADA + APLICACAO + CODSENTENCA) — same
 * live read as fetchSentencesFromTotvs above, just scoped to a single exact match instead of a
 * Filter model's free-text expression. Powers the SOAP Builder's "Buscar sentença" button: given
 * the sentence exists, the caller can then parse its SQL text for `:PARAM` references. Returns
 * null when TOTVS reports no matching row (unknown sentence, wrong coligada/sistema, or no
 * permission — ReadView doesn't distinguish these, see soap-builder-client.tsx's own noDataWarning).
 */
export async function lookupSentenceContent(
  key: { codColigada: number; codSistema: string; codSentenca: string },
  tbc: Pick<TbcForRm, "link" | "user" | "password" | "notRequiredLicense">,
  organizationId: string,
  context?: SoapContext
): Promise<string | null> {
  const endpointType = await soapEndpointService.getActiveTypeByKey("dataserver");
  const endpointMethod = await soapEndpointService.getActiveMethodByKey(endpointType.id, "READVIEW");

  const filtro = qualifyGConsSqlColumns(
    `CODCOLIGADA=${key.codColigada} AND APLICACAO='${escapeFilterLiteral(key.codSistema)}' AND CODSENTENCA='${escapeFilterLiteral(key.codSentenca)}'`
  );
  const methodXml = `<ReadView>
  <DataServerName>${escapeXml(GLB_CONS_SQL_DATA)}</DataServerName>
  <Filtro>${escapeXml(filtro)}</Filtro>
</ReadView>`;

  const result = await soapService.execute(
    {
      tbc: {
        link: tbc.link,
        user: tbc.user,
        password: tbc.password,
        notRequiredLicense: tbc.notRequiredLicense,
      },
      wsName: endpointType.suffix as WsName,
      method: endpointMethod.method as SoapMethod,
      xml: methodXml,
      context,
    },
    organizationId
  );

  const rows = extractConsSqlRows(result.jsonResponse);
  if (rows.length === 0) return null;
  return String(rows[0].SENTENCA ?? "");
}

/**
 * Writes a sentence definition back to GConsSql via wsDataServer.SaveRecord. Defaults to the
 * confirmed DataServerName (GlbConsSqlData, same object read by fetchSentencesFromTotvs above);
 * RM_GCONSSQL_DATASERVER_NAME only needs to be set to override that for a non-standard install.
 */
export async function restoreSentenceToTbc(
  tbc: TbcForRm,
  sentence: Pick<RmSentenceRecord, "codeSentence" | "codColigada" | "codSystem" | "nameSentence" | "contentSentence">,
  organizationId: string
): Promise<void> {
  if (env.RM_SENTENCE_SERVICE_MODE === "mock") return;

  // <DataServerName> is the ws-level identifier (GlbConsSqlData); the record's own XML root must
  // be the underlying table name (GCONSSQL) — same distinction the user confirmed for ReadView's
  // Filtro. Untested live (restricted to AutenticaAcesso/CheckServiceActivity/IsValidDataServer) —
  // flagging this inference so it gets verified before relying on it.
  const dataServerName = env.RM_GCONSSQL_DATASERVER_NAME || GLB_CONS_SQL_DATA;
  const recordXml = `<${GCONSSQL_TABLE}>
  <CODCOLIGADA>${escapeXml(sentence.codColigada)}</CODCOLIGADA>
  <APLICACAO>${escapeXml(sentence.codSystem)}</APLICACAO>
  <CODSENTENCA>${escapeXml(sentence.codeSentence)}</CODSENTENCA>
  <SENTENCA><![CDATA[${sentence.contentSentence}]]></SENTENCA>
</${GCONSSQL_TABLE}>`;

  const methodXml = `<SaveRecord>
  <DataServerName>${escapeXml(dataServerName)}</DataServerName>
  <XML>${cdata(recordXml)}</XML>
</SaveRecord>`;

  // Resolve the ws folder + method from what's actually registered (and active) in
  // /admin/soap-endpoints instead of hardcoding "wsDataServer"/"SAVERECORD" here.
  const endpointType = await soapEndpointService.getActiveTypeByKey("dataserver");
  const endpointMethod = await soapEndpointService.getActiveMethodByKey(endpointType.id, "SAVERECORD");

  await soapService.execute(
    {
      tbc: {
        id: tbc.id,
        link: tbc.link,
        user: tbc.user,
        password: tbc.password,
        notRequiredLicense: tbc.notRequiredLicense,
      },
      wsName: endpointType.suffix as WsName,
      method: endpointMethod.method as SoapMethod,
      xml: methodXml,
      context: { user: tbc.user },
    },
    organizationId
  );
}
