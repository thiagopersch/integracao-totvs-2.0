export type SoapContext = {
  coligate?: number;
  branch?: number;
  levelEducation?: number;
  codSystem?: string;
  user?: string;
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
