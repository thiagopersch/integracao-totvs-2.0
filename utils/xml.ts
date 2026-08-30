import { XMLParser, XMLBuilder } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: true,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
});

export function xmlToJson(xml: string): Record<string, unknown> {
  return parser.parse(xml);
}

export function jsonToXml(json: Record<string, unknown>): string {
  return builder.build(json);
}

export function formatXml(xml: string): string {
  const json = xmlToJson(xml);
  const built = builder.build(json);
  // Same force-escape quirk formatXmlDeep works around below: the builder re-encodes quotes in
  // attribute values regardless of source formatting — harmless here since this is display-only,
  // never re-parsed as XML.
  return built.replace(/&apos;/g, "'").replace(/&quot;/g, "\"");
}

/** TOTVS's nested dataset text carries raw numeric char refs (`&#xD;` for embedded line breaks)
 *  that fast-xml-parser leaves undecoded unless htmlEntities is on — kept off the default `parser`
 *  above so formatXml/xmlToJson behavior elsewhere is unchanged, and only used by formatXmlDeep.
 *  parseAttributeValue is off here (unlike `parser` above) because this is a pure round-trip
 *  formatter — numeric-coercing an attribute like the envelope's own `version="1.0"` turns it into
 *  the JS number 1, which then re-serializes as "1" and corrupts the XML declaration on display. */
const deepParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  trimValues: true,
  parseTagValue: true,
  htmlEntities: true,
});

/**
 * formatXmlDeep is a read-only display formatter (CodeMirror viewer), never re-parsed as XML
 * elsewhere, so favor raw legibility over strict validity: leave text content completely
 * unescaped instead of re-encoding a literal `<`/`&` that survived decoding (e.g. an embedded
 * `<br/>` fragment inside a SQL string) back into `&lt;`/`&amp;` noise.
 */
const deepBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
  processEntities: false,
  tagValueProcessor: (_name, value) => String(value),
});

const NESTED_XML_PATTERN = /^<([A-Za-z_][\w.:-]*)(?:\s[^>]*)?>[\s\S]*<\/\1>\s*$/;

/** A single left-to-right entity-decode pass (mirrors services/soap.service.ts's decodeXmlEntities).
 *  Some TOTVS fields are escaped 2-3 layers deep and inconsistently — e.g. the same response can mix
 *  a once-escaped `&apos;` with a twice-escaped `&amp;#xD;` — and each XML parse only removes one
 *  layer, so a single pass here leaves residue like a literal `&apos;` behind in SQL text. */
function decodeEntitiesOnce(value: string): string {
  return value
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // must be last so "&amp;lt;" round-trips to literal "&lt;" text, not "<"
}

/** Repeats decodeEntitiesOnce until the string stabilizes, to peel arbitrarily deep escaping. */
function fullyDecodeEntities(value: string): string {
  let current = value;
  for (let i = 0; i < 6; i++) {
    const next = decodeEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function unescapeNestedXml(node: unknown): unknown {
  if (typeof node === "string") {
    const trimmed = node.trim();
    // Only re-parse as XML BEFORE any extra entity-decoding — decoding first could turn an
    // escaped tag-like fragment sitting inside plain text (e.g. a SQL string's own `&lt;br/&gt;`)
    // into a real tag too early, which then gets mis-parsed as structure by deepParser below.
    if (NESTED_XML_PATTERN.test(trimmed)) {
      try {
        const nested = deepParser.parse(trimmed) as Record<string, unknown>;
        if (Object.keys(nested).length) return unescapeNestedXml(nested);
      } catch {
        // not actually well-formed XML — fall through and treat as terminal text
      }
    }
    // Terminal leaf text: safe to fully resolve any leftover escaping depth for display.
    return fullyDecodeEntities(node);
  }
  if (Array.isArray(node)) return node.map(unescapeNestedXml);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, unescapeNestedXml(v)])
    );
  }
  return node;
}

/**
 * Like formatXml, but also re-parses any text leaf that is itself a complete escaped XML
 * document (TOTVS *Result fields nest a second XML/dataset document this way) so it renders
 * as real indented elements instead of a wall of &lt;/&amp;#xD; escapes.
 */
export function formatXmlDeep(xml: string): string {
  const json = deepParser.parse(xml) as Record<string, unknown>;
  const built = deepBuilder.build(unescapeNestedXml(json) as Record<string, unknown>);
  // The builder force-escapes quotes in attribute values regardless of tagValueProcessor above —
  // harmless here since this output is only ever displayed, never re-parsed as XML.
  return built.replace(/&apos;/g, "'").replace(/&quot;/g, "\"");
}

/** Some logged values are plain scalars (e.g. AutenticaAcessoResult "1", CheckServiceActivityResult
 *  "true") rather than XML — formatXml silently returns "" for those, so fall back to the raw text. */
export function safeFormatXml(value: string): string {
  try {
    const formatted = formatXml(value);
    return formatted.trim() ? formatted : value;
  } catch {
    return value;
  }
}

/** ReadViewResult/GetSchemaResult-style fields nest a second, XML-escaped XML document inside a
 *  text node — safeFormatXml only unescapes the outer envelope, so fall back to that if the
 *  deeper re-parse fails instead of showing the raw, unescaped blob. */
export function safeFormatXmlDeep(value: string): string {
  try {
    const formatted = formatXmlDeep(value);
    return formatted.trim() ? formatted : value;
  } catch {
    return safeFormatXml(value);
  }
}

export function extractSoapBody(xml: string): string {
  const match = xml.match(/<soap:Body[^>]*>([\s\S]*?)<\/soap:Body>/);
  return match ? match[1].trim() : xml;
}

export function extractSoapError(xml: string): string | null {
  const match = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
  return match ? match[1].trim() : null;
}

/** The DataServer/Process code actually invoked, read off the `<DataServerName>`/`<ProcessServerName>`
 *  tag the SOAP Builder embeds in the method body (see soap-builder-client.tsx's ENTITY_NAME_TAG) —
 *  present on ReadView/ReadRecord/SaveRecord/DeleteRecord/GetSchema/process-execution calls, absent
 *  on AUTENTICAACESSO/CHECKSERVICEACTIVITY and consulta SQL/relatório/fórmula visual calls. */
export function extractEntityName(xml: string): { type: "dataserver" | "process"; name: string } | null {
  const dataserverMatch = xml.match(/<DataServerName[^>]*>([\s\S]*?)<\/DataServerName>/i);
  if (dataserverMatch && dataserverMatch[1].trim()) return { type: "dataserver", name: dataserverMatch[1].trim() };
  const processMatch = xml.match(/<ProcessServerName[^>]*>([\s\S]*?)<\/ProcessServerName>/i);
  if (processMatch && processMatch[1].trim()) return { type: "process", name: processMatch[1].trim() };
  return null;
}
