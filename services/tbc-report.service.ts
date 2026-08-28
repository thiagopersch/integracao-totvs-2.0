import { soapService, type TbcCredentials } from "@/services/soap.service";
import { escapeXml } from "@/utils/soap-envelope";
import { jsonToXml } from "@/utils/xml";
import {
  parseReportListResponse,
  parseReportInfoResponse,
  parseGeneratedReportStatus,
  type TbcReportListItem,
  type RptReportPar,
} from "@/utils/tbc-report-parser";

export type ReportTarget = {
  codColigada: number;
  codSistema: string;
  codReport: string;
};

export type ReportGenerationInput = ReportTarget & {
  fileName: string;
  /** Full filter/parameter objects as returned by getReportInfo, with `Value` edited by the user —
   *  TOTVS expects the whole RptFilterReportPar/RptParameterReportPar structure echoed back, not a
   *  flat key/value map. */
  filters: RptReportPar[];
  parameters: RptReportPar[];
};

/** Fixed-size download window — keeps every `GetFileChunk` response (and the `SoapLog` row it's
 *  logged into) bounded regardless of how large the generated report ends up being. */
const CHUNK_SIZE = 2 * 1024 * 1024;

function serializeParArray(items: RptReportPar[], wrapperTag: string, itemTag: string): string {
  const body =
    items.length === 0
      ? `<${wrapperTag} xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.totvs.com.br/RM/" />`
      : jsonToXml({
          [wrapperTag]: {
            "@_xmlns:i": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xmlns": "http://www.totvs.com.br/RM/",
            [itemTag]: items,
          },
        }).trim();

  return `<?xml version="1.0" encoding="utf-16"?>\n${body}`;
}

export const tbcReportService = {
  async listReports(
    tbc: TbcCredentials,
    organizationId: string,
    codColigada: number,
    userId?: string,
    codSistema?: string
  ): Promise<TbcReportListItem[]> {
    const res = await soapService.execute(
      { tbc, wsName: "wsReport", method: "GETREPORTLIST", xml: `<GetReportList><codColigada>${codColigada}</codColigada></GetReportList>` },
      organizationId,
      userId
    );
    const reports = parseReportListResponse(res.xmlResponse.trim());
    // GetReportList only takes codColigada — TOTVS has no per-system filter on this call — so a
    // system filter is applied here, after the fact. The `codSistema` token in each row is TOTVS's
    // own full module display name (e.g. "TOTVS Educacional"), NOT the short internal system code —
    // confirmed against TOTVS's own docs sample (GetReportList response: "0,TOTVS Educacional,306,
    // Boletim,..."). Callers must pass the Sistema catalog's `externalName`, not its `code`.
    if (!codSistema) return reports;
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
    const target = normalize(codSistema);
    return reports.filter((r) => normalize(r.codSistema) === target);
  },

  async getReportInfo(
    tbc: TbcCredentials,
    organizationId: string,
    target: ReportTarget,
    userId?: string
  ): Promise<{ filters: RptReportPar[]; parameters: RptReportPar[] }> {
    const res = await soapService.execute(
      {
        tbc,
        wsName: "wsReport",
        method: "GETREPORTINFO",
        xml: `<GetReportInfo><codColigada>${target.codColigada}</codColigada><idReport>${escapeXml(target.codReport)}</idReport></GetReportInfo>`,
      },
      organizationId,
      userId
    );
    return parseReportInfoResponse(res.xmlResponse);
  },

  async generateReportAsync(
    tbc: TbcCredentials,
    organizationId: string,
    input: ReportGenerationInput,
    timeoutMs: number,
    userId?: string
  ): Promise<{ guid: string }> {
    const res = await soapService.execute(
      {
        tbc,
        wsName: "wsReport",
        method: "GENERATEREPORTASYNCHRONOUS",
        xml: buildGenerateXml(input, "GenerateReportAsynchronous"),
        timeout: timeoutMs,
      },
      organizationId,
      userId
    );
    return { guid: res.xmlResponse.trim() };
  },

  async generateReportSync(
    tbc: TbcCredentials,
    organizationId: string,
    input: ReportGenerationInput,
    timeoutMs: number,
    userId?: string
  ): Promise<{ guid: string }> {
    const res = await soapService.execute(
      { tbc, wsName: "wsReport", method: "GENERATEREPORT", xml: buildGenerateXml(input, "GenerateReport"), timeout: timeoutMs },
      organizationId,
      userId
    );
    return { guid: res.xmlResponse.trim() };
  },

  async pollStatus(
    tbc: TbcCredentials,
    organizationId: string,
    guid: string,
    timeoutMs: number,
    userId?: string
  ) {
    const res = await soapService.execute(
      { tbc, wsName: "wsReport", method: "GETGENERATEDREPORTSTATUS", xml: `<GetGeneratedReportStatus><id>${escapeXml(guid)}</id></GetGeneratedReportStatus>`, timeout: timeoutMs },
      organizationId,
      userId
    );
    return parseGeneratedReportStatus(res.xmlResponse.trim());
  },

  async downloadReport(
    tbc: TbcCredentials,
    organizationId: string,
    guid: string,
    userId?: string
  ): Promise<{ base64: string; byteLength: number }> {
    const sizeRes = await soapService.execute(
      { tbc, wsName: "wsReport", method: "GETGENERATEDREPORTSIZE", xml: `<GetGeneratedReportSize><guid>${escapeXml(guid)}</guid></GetGeneratedReportSize>` },
      organizationId,
      userId
    );
    const byteLength = Number(sizeRes.xmlResponse.trim()) || 0;
    if (byteLength === 0) return { base64: "", byteLength: 0 };

    const chunks: Buffer[] = [];
    for (let offset = 0; offset < byteLength; offset += CHUNK_SIZE) {
      const length = Math.min(CHUNK_SIZE, byteLength - offset);
      const chunkRes = await soapService.execute(
        {
          tbc,
          wsName: "wsReport",
          method: "GETFILECHUNK",
          xml: `<GetFileChunk><guid>${escapeXml(guid)}</guid><offset>${offset}</offset><length>${length}</length></GetFileChunk>`,
        },
        organizationId,
        userId
      );
      chunks.push(Buffer.from(chunkRes.xmlResponse.trim(), "base64"));
    }

    return { base64: Buffer.concat(chunks).toString("base64"), byteLength };
  },
};

function buildGenerateXml(input: ReportGenerationInput, tag: "GenerateReport" | "GenerateReportAsynchronous"): string {
  const filtersXml = serializeParArray(input.filters, "ArrayOfRptFilterReportPar", "RptFilterReportPar");
  const parametersXml = serializeParArray(input.parameters, "ArrayOfRptParameterReportPar", "RptParameterReportPar");

  return [
    `<${tag}>`,
    `<codColigada>${input.codColigada}</codColigada>`,
    `<id>${escapeXml(input.codReport)}</id>`,
    `<filters><![CDATA[${filtersXml}]]></filters>`,
    `<parameters><![CDATA[${parametersXml}]]></parameters>`,
    `<fileName>${escapeXml(input.fileName)}</fileName>`,
    `</${tag}>`,
  ].join("");
}
