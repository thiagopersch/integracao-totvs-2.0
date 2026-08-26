import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/app.config";
import { buildSoapEnvelope, type SoapContext } from "@/utils/soap-envelope";
import { notificationService } from "@/services/notification.service";
import { buildSoapCallFailedNotification } from "@/lib/notification-types";
import { Prisma, type SoapMethod } from "@prisma/client";

/** The 5 real TOTVS RM webservice "folders" confirmed live against a TBC (wsConsultaSQL/wsDataServer/wsProcess/wsFormulaVisual/wsReport MEX WSDLs). */
export type WsName = "wsDataServer" | "wsConsultaSQL" | "wsProcess" | "wsFormulaVisual" | "wsReport";

export type TbcCredentials = {
  id?: string;
  link: string;
  user: string;
  password: string;
  notRequiredLicense: boolean;
};

export type SoapHistoryFilters = {
  clientId?: string;
  tbcId?: string;
  endpointTypeId?: string;
  method?: SoapMethod;
  status?: number[];
  dateFrom?: Date;
  dateTo?: Date;
  minDurationMs?: number;
};

export type SoapRequest = {
  tbc: TbcCredentials;
  wsName: WsName;
  method: SoapMethod;
  xml: string;
  context?: SoapContext;
  timeout?: number;
  endpointType?: string;
};

export type SoapResponse = {
  xmlResponse: string;
  jsonResponse: Record<string, unknown>;
  duration: number;
  status: number;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
});

/**
 * Every real TOTVS RM webservice exposes the same 3 "ports" at
 * {baseUrl}/{EduLicense?}{wsName}/{PortInterface} (confirmed live via each
 * service's MEX WSDL): CheckServiceActivity always lives on IRMSServer,
 * AutenticaAcesso always lives on IwsBase, and every business method lives
 * on the service-specific port `Iws{PascalCase(wsName without "ws")}`
 * (e.g. wsDataServer -> IwsDataServer, wsConsultaSQL -> IwsConsultaSQL).
 * SOAPAction is always `http://www.totvs.com/{PortInterface}/{Operation}` —
 * NOT the flat `http://www.totvs.com/{Operation}` this file used before.
 */
const METHOD_OPERATION: Record<SoapMethod, string> = {
  AUTENTICAACESSO: "AutenticaAcesso",
  CHECKSERVICEACTIVITY: "CheckServiceActivity",
  GETSCHEMA: "GetSchema",
  GETSCHEMA2: "GetSchema2",
  READRECORD: "ReadRecord",
  READVIEW: "ReadView",
  SAVERECORD: "SaveRecord",
  DELETERECORD: "DeleteRecord",
  DELETERECORDBYKEY: "DeleteRecordByKey",
  ISVALIDDATASERVER: "IsValidDataServer",
  EXECUTEPROCESS: "ExecuteProcess",
  EXECUTEWITHXMLPARAMS: "ExecuteWithXmlParams",
  EXECUTEWITHXMLPARAMSASYNC: "ExecuteWithXmlParamsAsync",
  GETPROCESSSTATUS: "GetProcessStatus",
  REALIZARCONSULTASQL: "RealizarConsultaSQL",
  REALIZARCONSULTASQLCONTEXTO: "RealizarConsultaSQLContexto",
  GETREPORTLIST: "GetReportList",
  GETREPORTMETADATA: "GetReportMetaData",
  GETREPORTINFO: "GetReportInfo",
  GENERATEREPORT: "GenerateReport",
  GENERATEREPORTASYNCHRONOUS: "GenerateReportAsynchronous",
  GETGENERATEDREPORTSTATUS: "GetGeneratedReportStatus",
  GETGENERATEDREPORTSIZE: "GetGeneratedReportSize",
  GETFILECHUNK: "GetFileChunk",
  GETPARAMETERS: "GetParameters",
  EXECUTE: "Execute",
};

/** AutenticaAcesso/CheckServiceActivity are shared across every ws and don't live on the service-specific port. */
const SHARED_PORT: Partial<Record<SoapMethod, "IwsBase" | "IRMSServer">> = {
  AUTENTICAACESSO: "IwsBase",
  CHECKSERVICEACTIVITY: "IRMSServer",
};

function servicePortInterface(wsName: WsName, method: SoapMethod): string {
  return SHARED_PORT[method] ?? `Iws${wsName.slice(2)}`;
}

/** Wraps XML that is itself passed as the *content* of a SOAP parameter (e.g. SaveRecord's XML field), per TOTVS's requirement. */
export function cdata(xml: string): string {
  return `<![CDATA[${xml}]]>`;
}

/** `{baseLink}/{EduLicense prefix when notRequiredLicense}{wsName}/{PortInterface}` — verified live against a real TBC. */
function resolveUrl(tbc: TbcCredentials, wsName: WsName, method: SoapMethod): string {
  const base = tbc.link.replace(/\/+$/, "");
  const prefix = tbc.notRequiredLicense ? "EduLicense" : "";
  const port = servicePortInterface(wsName, method);
  return `${base}/${prefix}${wsName}/${port}`;
}

function resolveSoapAction(wsName: WsName, method: SoapMethod): string {
  const port = servicePortInterface(wsName, method);
  const operation = METHOD_OPERATION[method] ?? method;
  return `http://www.totvs.com/${port}/${operation}`;
}

/**
 * Every `xs:string`-typed *Result (GetSchema/ReadView/ReadRecord/SaveRecord/RealizarConsultaSQL…)
 * carries a SECOND, nested XML document as an entity-escaped string (confirmed against a real
 * ReadView response: `&lt;NewDataSet&gt;&amp;#xD;&lt;GConsSql&gt;...`). It must be decoded before
 * being handed to the XML parser, or the parser sees literal "&lt;" text (not a tag) and silently
 * returns {} — which is why rows/results looked like they came back empty.
 */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // must be last so "&amp;lt;" round-trips to literal "&lt;" text, not "<"
}

function extractSoapResponse(xml: string, method: SoapMethod): string {
  const operation = METHOD_OPERATION[method] ?? method;
  const resultTag = new RegExp(`<${operation}Result[^>]*>([\\s\\S]*?)</${operation}Result>`, "i");
  const match = xml.match(resultTag);
  if (match) return decodeXmlEntities(match[1].trim());
  // Fallback: the whole <Body> is already real, single-layer XML — fast-xml-parser decodes its
  // entities itself during normal parsing, so it must NOT be pre-decoded here too (that would
  // turn a legitimately-escaped "&lt;" in element text into a bare "<" and break parsing).
  const bodyMatch = xml.match(/<(?:soap:)?Body[^>]*>([\s\S]*?)<\/(?:soap:)?Body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return xml;
}

class SoapFaultError extends Error {}

/** Detects a SOAP 1.1 <Fault> in the response body — a 200 status does NOT mean success, TOTVS returns business errors this way. */
function extractFaultMessage(xml: string): string | null {
  const faultMatch = xml.match(/<(?:[\w]+:)?Fault[^>]*>([\s\S]*?)<\/(?:[\w]+:)?Fault>/i);
  if (!faultMatch) return null;
  const body = faultMatch[1];
  const stringMatch = body.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
  if (stringMatch) return stringMatch[1].trim();
  const messageMatch = body.match(/<Message>([\s\S]*?)<\/Message>/i);
  return messageMatch ? messageMatch[1].trim() : "TOTVS retornou um erro SOAP (Fault) sem detalhes.";
}

export const soapService = {
  /**
   * Runs the request. Unless the method IS the auth handshake itself, this
   * always performs 1º AutenticaAcesso -> 2º CheckServiceActivity first, per
   * the required TOTVS call order, before dispatching the real operation.
   */
  async execute(request: SoapRequest, organizationId: string, userId?: string): Promise<SoapResponse> {
    if (request.method !== "AUTENTICAACESSO" && request.method !== "CHECKSERVICEACTIVITY") {
      await this.authenticate(request.tbc, request.wsName, organizationId, userId);
    }
    return this.dispatch(request, organizationId, userId);
  },

  /** 1º AutenticaAcesso, 2º CheckServiceActivity — required before any other TOTVS call. */
  async authenticate(tbc: TbcCredentials, wsName: WsName, organizationId: string, userId?: string): Promise<void> {
    const authRes = await this.dispatch(
      { tbc, wsName, method: "AUTENTICAACESSO", xml: "<AutenticaAcesso />" },
      organizationId,
      userId
    );
    // AutenticaAcessoResult / CheckServiceActivityResult are plain scalars (not XML-in-string
    // like GetSchema/ReadRecord's *Result), so read the extracted text directly rather than jsonResponse.
    const authResult = authRes.xmlResponse.trim();
    if (!authResult || authResult === "0") {
      throw new Error(`Falha na autenticação no TBC (${wsName}): verifique usuário e senha cadastrados.`);
    }

    const activityRes = await this.dispatch(
      { tbc, wsName, method: "CHECKSERVICEACTIVITY", xml: "<CheckServiceActivity />" },
      organizationId,
      userId
    );
    const active = activityRes.xmlResponse.trim().toLowerCase();
    if (active !== "true" && active !== "1") {
      throw new Error(`Serviço TOTVS (${wsName}) inativo ou indisponível para o TBC informado.`);
    }
  },

  /** Low-level HTTP dispatch — no auth handshake. Only call directly for AUTENTICAACESSO/CHECKSERVICEACTIVITY. */
  async dispatch(request: SoapRequest, organizationId: string, userId?: string): Promise<SoapResponse> {
    const startTime = Date.now();
    const timeout = request.timeout || env.SOAP_DEFAULT_TIMEOUT;
    const maxRetries = env.SOAP_MAX_RETRIES;
    const retryDelay = env.SOAP_RETRY_DELAY;

    const envelope = buildSoapEnvelope(request.xml, request.context);
    const soapAction = resolveSoapAction(request.wsName, request.method);
    const url = resolveUrl(request.tbc, request.wsName, request.method);
    const authHeader = "Basic " + Buffer.from(`${request.tbc.user}:${request.tbc.password}`).toString("base64");
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(url, envelope, {
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            SOAPAction: soapAction,
            Authorization: authHeader,
          },
          timeout,
          responseType: "text",
        });

        const duration = Date.now() - startTime;
        const xmlResponse = response.data as string;

        const faultMessage = extractFaultMessage(xmlResponse);
        if (faultMessage) throw new SoapFaultError(faultMessage);

        const extractedXml = extractSoapResponse(xmlResponse, request.method);
        const jsonResponse = xmlParser.parse(extractedXml) as Record<string, unknown>;

        await this.log(request, envelope, xmlResponse, jsonResponse, response.status, duration, null, organizationId, userId);

        return {
          xmlResponse: extractedXml,
          jsonResponse,
          duration,
          status: response.status,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof SoapFaultError) {
          logger.warn("SOAP fault (business error, not retried)", {
            wsName: request.wsName,
            method: request.method,
            error: error.message,
          });
          break;
        }

        if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
          lastError = new Error(
            error.response.status === 401
              ? `Autenticação HTTP rejeitada pelo TOTVS (usuário/senha do TBC inválidos) [${request.wsName}]`
              : `TOTVS retornou HTTP ${error.response.status} (não retentado): ${error.message}`
          );
          logger.warn("SOAP request rejected by TOTVS (client error, not retried)", {
            wsName: request.wsName,
            method: request.method,
            status: error.response.status,
          });
          break;
        }

        logger.warn(`SOAP attempt ${attempt}/${maxRetries} failed`, {
          wsName: request.wsName,
          method: request.method,
          error: (error as Error).message,
        });

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    const duration = Date.now() - startTime;
    const errorMsg = lastError?.message || "Unknown error";
    await this.log(request, envelope, null, null, 0, duration, errorMsg, organizationId, userId);

    // Only for user-initiated calls — internal/scheduled dispatches (no userId, e.g. backups)
    // are already covered by their own caller's failure notification, avoiding duplicate alerts.
    if (userId) {
      const notification = buildSoapCallFailedNotification({
        method: request.method,
        wsName: request.wsName,
        errorMessage: errorMsg,
      });
      await notificationService.create({ organizationId, userId, ...notification });
    }

    throw new Error(errorMsg);
  },

  async getSchema(tbc: TbcCredentials, wsName: WsName, organizationId: string, context?: SoapRequest["context"]): Promise<SoapResponse> {
    return this.execute(
      {
        tbc,
        wsName,
        method: "GETSCHEMA",
        xml: "<GetSchema />",
        context,
      },
      organizationId
    );
  },

  async log(
    request: SoapRequest,
    requestXml: string,
    xmlResponse: string | null | undefined,
    jsonResponse: Record<string, unknown> | null | undefined,
    status: number,
    duration: number,
    error: string | null | undefined,
    organizationId: string,
    userId?: string
  ): Promise<void> {
    try {
      await prisma.soapLog.create({
        data: {
          organizationId,
          userId,
          dataserver: request.tbc.link,
          process: request.wsName,
          method: request.method,
          // The full enveloped request actually sent over the wire (including the injected
          // <Contexto> and SOAP wrapper) — NOT request.xml, which is only the bare method body
          // the caller built before Contexto injection.
          xmlRequest: requestXml,
          xmlResponse,
          jsonResponse: jsonResponse === null ? Prisma.JsonNull : (jsonResponse as Prisma.InputJsonValue | undefined),
          status,
          duration,
          error,
          context: request.context as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (logError) {
      logger.error("Failed to save SOAP log", { error: logError });
    }
  },

  async getHistory(
    organizationId: string,
    page = 1,
    pageSize = 50,
    search?: string,
    filters?: SoapHistoryFilters,
    sort?: { field: string; direction: "asc" | "desc" }
  ) {
    const where: Prisma.SoapLogWhereInput = { organizationId };
    if (search) {
      where.OR = [
        { dataserver: { contains: search, mode: "insensitive" } },
        { process: { contains: search, mode: "insensitive" } },
      ];
    }

    if (filters?.tbcId) {
      const tbc = await prisma.tbc.findFirst({
        where: { id: filters.tbcId, organizationId },
        select: { link: true },
      });
      where.dataserver = tbc?.link ?? "__none__";
    } else if (filters?.clientId) {
      const tbcs = await prisma.tbc.findMany({
        where: { clientId: filters.clientId, organizationId, deletedAt: null },
        select: { link: true },
      });
      where.dataserver = { in: tbcs.map((t) => t.link) };
    }

    if (filters?.endpointTypeId) {
      const endpointType = await prisma.soapEndpointType.findUnique({
        where: { id: filters.endpointTypeId },
        select: { suffix: true },
      });
      where.process = endpointType?.suffix ?? "__none__";
    }

    if (filters?.method) where.method = filters.method;
    if (filters?.status?.length) where.status = { in: filters.status };
    if (filters?.minDurationMs) where.duration = { gte: filters.minDurationMs };
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const orderBy = sort ? { [sort.field]: sort.direction } : { createdAt: "desc" as const };
    const [data, total] = await Promise.all([
      prisma.soapLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.soapLog.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async listDistinctStatuses(organizationId: string) {
    const rows = await prisma.soapLog.findMany({
      where: { organizationId, status: { not: null } },
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
    });
    return rows.map((r) => r.status as number);
  },

  async saveTemplate(data: {
    userId?: string;
    name: string;
    description?: string;
    dataserver?: string;
    process?: string;
    method?: SoapMethod;
    xmlTemplate?: string;
    context?: Record<string, unknown>;
  }, organizationId: string) {
    return prisma.soapTemplate.create({
      data: { ...data, organizationId, context: data.context as Prisma.InputJsonValue | undefined },
    });
  },

  async getTemplates(organizationId: string, userId?: string) {
    const where = userId ? { organizationId, userId } : { organizationId };
    return prisma.soapTemplate.findMany({
      where,
      orderBy: { name: "asc" },
    });
  },

  async toggleFavorite(id: string, userId: string, organizationId: string, data: {
    name: string;
    dataserver?: string;
    process?: string;
    method?: SoapMethod;
    xml?: string;
    context?: Record<string, unknown>;
  }) {
    const existing = await prisma.soapFavorite.findFirst({
      where: { userId, organizationId, dataserver: data.dataserver, process: data.process, method: data.method },
    });

    if (existing) {
      await prisma.soapFavorite.delete({ where: { id: existing.id } });
      return false;
    }

    await prisma.soapFavorite.create({
      data: { userId, organizationId, ...data, context: data.context as Prisma.InputJsonValue | undefined },
    });
    return true;
  },

  async getFavorites(userId: string, organizationId: string) {
    return prisma.soapFavorite.findMany({
      where: { userId, organizationId },
      orderBy: { createdAt: "desc" },
    });
  },

  async deleteTemplate(id: string, organizationId: string) {
    await prisma.soapTemplate.delete({ where: { id, organizationId } });
  },

  async deleteFavorite(id: string, userId: string, organizationId: string) {
    await prisma.soapFavorite.delete({ where: { id, userId, organizationId } });
  },
};
