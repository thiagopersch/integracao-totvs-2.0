import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/app.config";
import { Prisma, type SoapMethod } from "@prisma/client";

export type SoapRequest = {
  dataserver: string;
  process: string;
  method: SoapMethod;
  xml: string;
  context?: {
    coligate?: number;
    branch?: number;
    levelEducation?: number;
    codSystem?: string;
    user?: string;
  };
  timeout?: number;
  endpointType?: string;
  suffix?: string;
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
 * Every real TOTVS RM webservice (wsDataServer, wsConsultaSQL, wsProcess,
 * wsFormulaVisual) shares this same SOAP 1.1 shape: the method body lives
 * directly under the `http://www.totvs.com/` namespace, e.g.
 *   <ReadRecord xmlns="http://www.totvs.com/">
 *     <DataServerName>...</DataServerName>
 *     <PrimaryKey>...</PrimaryKey>
 *     <Contexto>CodColigada=1;CodSistema=G;CodUsuario=mestre</Contexto>
 *   </ReadRecord>
 * confirmed against TOTVS's own SoapUI/DataServer reference doc. `Contexto`
 * is a flat `Key=Value;Key2=Value2` string, NOT nested XML — this previously
 * built an entirely fictitious `<Execute><DataServer>/<Process>/<XMLData>`
 * envelope that doesn't match any real TOTVS RM webservice.
 */
function buildContextoString(context?: SoapRequest["context"]): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.coligate !== undefined) parts.push(`CodColigada=${context.coligate}`);
  if (context.branch !== undefined) parts.push(`CodFilial=${context.branch}`);
  if (context.levelEducation !== undefined) parts.push(`CodColigadaAcademica=${context.levelEducation}`);
  if (context.codSystem) parts.push(`CodSistema=${context.codSystem}`);
  if (context.user) parts.push(`CodUsuario=${context.user}`);
  return parts.join(";");
}

function injectContexto(methodXml: string, contexto: string): string {
  if (!contexto || /<Contexto>/i.test(methodXml)) return methodXml;
  return methodXml.replace(
    /<\/([\w:]+)>\s*$/,
    (full, tag) => `  <Contexto>${escapeXml(contexto)}</Contexto>\n</${tag}>`
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(xml: string, context?: SoapRequest["context"]): string {
  const contexto = buildContextoString(context);
  const bodyXml = injectContexto(xml.trim(), contexto);
  const namespaced = bodyXml.replace(/^<([\w:]+)/, `<$1 xmlns="http://www.totvs.com/"`);

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${namespaced}
  </soap:Body>
</soap:Envelope>`;
}

function extractSoapResponse(xml: string, method: string): string {
  const resultTag = new RegExp(`<${method}Result[^>]*>([\\s\\S]*?)</${method}Result>`, "i");
  const match = xml.match(resultTag);
  if (match) return match[1].trim();
  const bodyMatch = xml.match(/<(?:soap:)?Body[^>]*>([\s\S]*?)<\/(?:soap:)?Body>/i);
  if (bodyMatch) return bodyMatch[1].trim();
  return xml;
}

/**
 * SOAPAction values confirmed against TOTVS's SoapUI/DataServer reference doc
 * (`http://www.totvs.com/{MethodName}`, PascalCase). REALIZARCONSULTASQL(CONTEXTO)
 * are wsConsultaSQL's real methods for running a saved SQL sentence and getting
 * its result rows back — available for manual use from the SOAP Builder
 * ("Consulta SQL"). The filter-backup feature itself always reads this app's
 * own `sentences` table, not this endpoint. EXECUTEPROCESS is intentionally
 * not mapped here:
 * it isn't a confirmed real wsProcess method (the real ones are
 * ExecuteWithXmlParams/ExecuteWithXmlParamsAsync/GetProcessStatus) and is kept
 * in the enum only because older seed data for the Fórmulas/Relatórios endpoint
 * types (out of scope for this pass) still reference it.
 */
const SOAP_ACTIONS: Partial<Record<SoapMethod, string>> = {
  GETSCHEMA: "http://www.totvs.com/GetSchema",
  READRECORD: "http://www.totvs.com/ReadRecord",
  READVIEW: "http://www.totvs.com/ReadView",
  SAVERECORD: "http://www.totvs.com/SaveRecord",
  DELETERECORD: "http://www.totvs.com/DeleteRecord",
  ISVALIDDATASERVER: "http://www.totvs.com/IsValidDataServer",
  EXECUTEWITHXMLPARAMS: "http://www.totvs.com/ExecuteWithXmlParams",
  EXECUTEWITHXMLPARAMSASYNC: "http://www.totvs.com/ExecuteWithXmlParamsAsync",
  GETPROCESSSTATUS: "http://www.totvs.com/GetProcessStatus",
  GETSCHEMA2: "http://www.totvs.com/GetSchema2",
  CHECKSERVICEACTIVITY: "http://www.totvs.com/CheckServiceActivity",
  REALIZARCONSULTASQL: "http://www.totvs.com/RealizarConsultaSQL",
  REALIZARCONSULTASQLCONTEXTO: "http://www.totvs.com/RealizarConsultaSQLContexto",
};

function getSoapAction(method: SoapMethod): string {
  return SOAP_ACTIONS[method] || `http://www.totvs.com/${method}`;
}

export const soapService = {
  async execute(request: SoapRequest, organizationId: string, userId?: string): Promise<SoapResponse> {
    const startTime = Date.now();
    const timeout = request.timeout || env.SOAP_DEFAULT_TIMEOUT;
    const maxRetries = env.SOAP_MAX_RETRIES;
    const retryDelay = env.SOAP_RETRY_DELAY;

    const envelope = buildSoapEnvelope(request.xml, request.context);
    const soapAction = getSoapAction(request.method);
    let lastError: Error | null = null;

    const url = request.suffix
      ? `${request.dataserver.replace(/\/+$/, "")}${request.suffix.startsWith("/") ? request.suffix : `/${request.suffix}`}`
      : `${request.dataserver}/${request.process}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          url,
          envelope,
          {
            headers: {
              "Content-Type": "text/xml; charset=utf-8",
              SOAPAction: soapAction,
            },
            timeout,
            responseType: "text",
          }
        );

        const duration = Date.now() - startTime;
        const xmlResponse = response.data as string;
        const extractedXml = extractSoapResponse(xmlResponse, request.method);
        const jsonResponse = xmlParser.parse(extractedXml) as Record<string, unknown>;

        await this.log(request, xmlResponse, jsonResponse, response.status, duration, null, organizationId, userId);

        return {
          xmlResponse: extractedXml,
          jsonResponse,
          duration,
          status: response.status,
        };
      } catch (error) {
        lastError = error as Error;
        logger.warn(`SOAP attempt ${attempt}/${maxRetries} failed`, {
          dataserver: request.dataserver,
          process: request.process,
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
    await this.log(request, null, null, 0, duration, errorMsg, organizationId, userId);

    throw new Error(`SOAP execution failed after ${maxRetries} attempts: ${errorMsg}`);
  },

  async getSchema(dataserver: string, process: string, organizationId: string, context?: SoapRequest["context"]): Promise<SoapResponse> {
    return this.execute(
      {
        dataserver,
        process,
        method: "GETSCHEMA",
        xml: "<GetSchema />",
        context,
      },
      organizationId
    );
  },

  async log(
    request: SoapRequest,
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
          dataserver: request.dataserver,
          process: request.process,
          method: request.method,
          xmlRequest: request.xml,
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

  async getHistory(organizationId: string, page = 1, pageSize = 50, search?: string) {
    const where: Prisma.SoapLogWhereInput = { organizationId };
    if (search) {
      where.OR = [
        { dataserver: { contains: search, mode: "insensitive" } },
        { process: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.soapLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
