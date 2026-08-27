import type { SoapMethod } from "@prisma/client";

export type SoapContext = {
  coligate?: number;
  branch?: number;
  levelEducation?: number;
  codSystem?: string;
  user?: string;
};

/**
 * Maps each `SoapMethod` enum value (ALL_CAPS, as stored in the DB/Prisma) to the real PascalCase
 * TOTVS RM SOAP operation name. The root element of every request XML — built here and on the
 * server (services/soap.service.ts re-exports this same map) — must use this exact casing: TOTVS
 * matches the operation by element name, so `<READRECORD />` is rejected while `<ReadRecord />`
 * is accepted.
 */
export const METHOD_OPERATION: Record<SoapMethod, string> = {
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

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Contexto field names/casing must match TOTVS RM's own standard exactly — every method relies on
 * this to execute correctly: CODCOLIGADA, CODFILIAL, CODTIPOCURSO, CODSISTEMA, CODUSUARIO.
 */
function buildContextoString(context?: SoapContext): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.coligate !== undefined) parts.push(`CODCOLIGADA=${context.coligate}`);
  if (context.branch !== undefined) parts.push(`CODFILIAL=${context.branch}`);
  if (context.levelEducation !== undefined) parts.push(`CODTIPOCURSO=${context.levelEducation}`);
  if (context.codSystem) parts.push(`CODSISTEMA=${context.codSystem}`);
  if (context.user) parts.push(`CODUSUARIO=${context.user}`);
  return parts.join(";");
}

function injectContexto(methodXml: string, contexto: string): string {
  if (!contexto || /<Contexto>/i.test(methodXml)) return methodXml;
  return methodXml.replace(
    /<\/([\w:]+)>\s*$/,
    (full, tag) => `  <Contexto>${escapeXml(contexto)}</Contexto>\n</${tag}>`
  );
}

/** Builds the exact envelope TOTVS RM receives on the wire — same shape used to log `xmlRequest` in history, so the builder's live preview matches it. */
export function buildSoapEnvelope(xml: string, context?: SoapContext): string {
  const contexto = buildContextoString(context);
  const bodyXml = injectContexto(xml.trim(), contexto);
  const namespaced = bodyXml.replace(/^<([\w:]+)(\s*\/?)/, `<$1 xmlns="http://www.totvs.com/"$2`);

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    ${namespaced}
  </soap:Body>
</soap:Envelope>`;
}
