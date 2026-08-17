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
  return builder.build(json);
}

export function extractSoapBody(xml: string): string {
  const match = xml.match(/<soap:Body[^>]*>([\s\S]*?)<\/soap:Body>/);
  return match ? match[1].trim() : xml;
}

export function extractSoapError(xml: string): string | null {
  const match = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
  return match ? match[1].trim() : null;
}
