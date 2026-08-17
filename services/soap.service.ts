import axios from "axios";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/app.config";
import type { SoapMethod } from "@prisma/client";

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

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: "  ",
});

function buildSoapEnvelope(xml: string, context?: SoapRequest["context"]): string {
  const contextXml = context
    ? `
    <Context>
      ${context.coligate ? `<Coligate>${context.coligate}</Coligate>` : ""}
      ${context.branch ? `<Branch>${context.branch}</Branch>` : ""}
      ${context.levelEducation ? `<LevelEducation>${context.levelEducation}</LevelEducation>` : ""}
      ${context.codSystem ? `<CodSystem>${context.codSystem}</CodSystem>` : ""}
      ${context.user ? `<User>${context.user}</User>` : ""}
    </Context>`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <Execute xmlns="http://www.totvs.com/rm/dataserver/">
      <DataServer>${context?.codSystem || ""}</DataServer>
      <Process>${context?.codSystem || ""}</Process>
      <XMLData>${xml}</XMLData>
      ${contextXml}
    </Execute>
  </soap:Body>
</soap:Envelope>`;
}

function extractSoapResponse(xml: string): string {
  const match = xml.match(/<ExecuteResult[^>]*>([\s\S]*?)<\/ExecuteResult>/);
  if (match) return match[1].trim();
  const bodyMatch = xml.match(/<soap:Body[^>]*>([\s\S]*?)<\/soap:Body>/);
  if (bodyMatch) return bodyMatch[1].trim();
  return xml;
}

const SOAP_ACTIONS: Partial<Record<SoapMethod, string>> = {
  GETSCHEMA: "http://www.totvs.com/rm/dataserver/GetSchema",
  READRECORD: "http://www.totvs.com/rm/dataserver/ReadRecord",
  READVIEW: "http://www.totvs.com/rm/dataserver/ReadView",
  SAVERECORD: "http://www.totvs.com/rm/dataserver/SaveRecord",
  DELETERECORD: "http://www.totvs.com/rm/dataserver/DeleteRecord",
  ISVALIDDATASERVER: "http://www.totvs.com/rm/dataserver/IsValidDataServer",
  EXECUTEPROCESS: "http://www.totvs.com/rm/process/ExecuteProcess",
  EXECUTEWITHXMLPARAMS: "http://www.totvs.com/rm/process/ExecuteWithXmlParams",
  EXECUTEWITHXMLPARAMSASYNC: "http://www.totvs.com/rm/process/ExecuteWithXmlParamsAsync",
  GETPROCESSSTATUS: "http://www.totvs.com/rm/process/GetProcessStatus",
  GETSCHEMA2: "http://www.totvs.com/rm/process/GetSchema2",
  CHECKSERVICEACTIVITY: "http://www.totvs.com/rm/common/CheckServiceActivity",
};

function getSoapAction(method: SoapMethod): string {
  return SOAP_ACTIONS[method] || `http://www.totvs.com/rm/${method}`;
}

export const soapService = {
  async execute(request: SoapRequest): Promise<SoapResponse> {
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
        const extractedXml = extractSoapResponse(xmlResponse);
        const jsonResponse = xmlParser.parse(extractedXml) as Record<string, unknown>;

        await this.log(request, xmlResponse, jsonResponse, response.status, duration, null);

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
    await this.log(request, null, null, 0, duration, errorMsg);

    throw new Error(`SOAP execution failed after ${maxRetries} attempts: ${errorMsg}`);
  },

  async getSchema(dataserver: string, process: string, context?: SoapRequest["context"]): Promise<SoapResponse> {
    return this.execute({
      dataserver,
      process,
      method: "GETSCHEMA",
      xml: "<GetSchema />",
      context,
    });
  },

  async log(
    request: SoapRequest,
    xmlResponse: string | null | undefined,
    jsonResponse: Record<string, unknown> | null | undefined,
    status: number,
    duration: number,
    error: string | null | undefined
  ): Promise<void> {
    try {
      await prisma.soapLog.create({
        data: {
          dataserver: request.dataserver,
          process: request.process,
          method: request.method,
          xmlRequest: request.xml,
          xmlResponse,
          jsonResponse: jsonResponse as any,
          status,
          duration,
          error,
          context: request.context as any,
        },
      });
    } catch (logError) {
      logger.error("Failed to save SOAP log", { error: logError });
    }
  },

  async getHistory(page = 1, pageSize = 50, search?: string) {
    const where: any = {};
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
  }) {
    return prisma.soapTemplate.create({ data: data as any });
  },

  async getTemplates(userId?: string) {
    const where = userId ? { userId } : {};
    return prisma.soapTemplate.findMany({
      where,
      orderBy: { name: "asc" },
    });
  },

  async toggleFavorite(id: string, userId: string, data: {
    name: string;
    dataserver?: string;
    process?: string;
    method?: SoapMethod;
    xml?: string;
    context?: Record<string, unknown>;
  }) {
    const existing = await prisma.soapFavorite.findFirst({
      where: { userId, dataserver: data.dataserver, process: data.process, method: data.method },
    });

    if (existing) {
      await prisma.soapFavorite.delete({ where: { id: existing.id } });
      return false;
    }

    await prisma.soapFavorite.create({ data: { userId, ...data } as any });
    return true;
  },

  async getFavorites(userId: string) {
    return prisma.soapFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },
};
