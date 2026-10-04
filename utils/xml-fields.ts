import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser"
import { inferType } from "@/utils/soap-schema"

/** One editable value in an XML document — `path` indexes into the preserveOrder node tree. */
export type XmlLeafField = {
  path: number[]
  label: string
  value: string
  /** From the element's own `i:type` attribute when present, else inferred from the sample value. */
  type: string
}

/** Leaf fields grouped by the element that directly holds them (one section per element). */
export type XmlLeafGroup = {
  key: string
  name: string
  fields: XmlLeafField[]
}

type OrderedNode = Record<string, unknown>

const ATTRS = ":@"
const TEXT = "#text"

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  ignoreDeclaration: true,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
})

const builder = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: false,
})

function localName(key: string): string {
  const idx = key.indexOf(":")
  return idx === -1 ? key : key.slice(idx + 1)
}

function tagOf(node: OrderedNode): string | null {
  return Object.keys(node).find((k) => k !== ATTRS && k !== TEXT) ?? null
}

function childrenOf(node: OrderedNode): OrderedNode[] {
  const tag = tagOf(node)
  return tag ? ((node[tag] as OrderedNode[]) ?? []) : []
}

function elementChildren(node: OrderedNode): Array<{ node: OrderedNode; index: number }> {
  return childrenOf(node)
    .map((child, index) => ({ node: child, index }))
    .filter(({ node: child }) => tagOf(child) !== null)
}

function isLeaf(node: OrderedNode): boolean {
  return tagOf(node) !== null && elementChildren(node).length === 0
}

/** `i:type="d2p1:int"` → "int"; falls back to the sample value's shape. */
function leafType(node: OrderedNode, value: string): string {
  const attrs = (node[ATTRS] as Record<string, unknown> | undefined) ?? {}
  const typeAttr = Object.entries(attrs).find(([key]) => localName(key.replace(/^@_/, "")) === "type")?.[1]
  return typeAttr ? localName(String(typeAttr)) : inferType(value)
}

function leafText(node: OrderedNode): string {
  const text = childrenOf(node).find((c) => TEXT in c)
  return text ? String(text[TEXT] ?? "") : ""
}

/** WCF `KeyValueOfanyTypeanyType` pair — the process's real input parameters (`_params`). */
function keyValueParts(node: OrderedNode) {
  if (localName(tagOf(node) ?? "") !== "KeyValueOfanyTypeanyType") return null
  const children = elementChildren(node)
  const key = children.find((c) => localName(tagOf(c.node) ?? "") === "Key")
  const value = children.find((c) => localName(tagOf(c.node) ?? "") === "Value")
  if (!key || !value || !isLeaf(key.node) || !isLeaf(value.node)) return null
  const text = leafText(value.node)
  return { key: leafText(key.node), valueIndex: value.index, value: text, type: leafType(value.node, text) }
}

function parse(xml: string): OrderedNode[] {
  if (XMLValidator.validate(xml) !== true) throw new Error("XML inválido")
  return parser.parse(xml) as OrderedNode[]
}

/**
 * Every editable leaf value of an XML document (e.g. a process's GetSchema sample instance),
 * grouped by its parent element. A `KeyValueOfanyTypeanyType` pair becomes one field labeled by its
 * Key with its Value editable. Empty for unparseable XML.
 */
export function listXmlLeafGroups(xml: string): XmlLeafGroup[] {
  let roots: OrderedNode[]
  try {
    roots = parse(xml)
  } catch {
    return []
  }
  const groups: XmlLeafGroup[] = []

  function walk(node: OrderedNode, path: number[]) {
    const fields: XmlLeafField[] = []
    for (const { node: child, index } of elementChildren(node)) {
      const childPath = [...path, index]
      const kv = keyValueParts(child)
      if (kv) {
        fields.push({ path: [...childPath, kv.valueIndex], label: kv.key, value: kv.value, type: kv.type })
      } else if (isLeaf(child)) {
        const text = leafText(child)
        fields.push({ path: childPath, label: localName(tagOf(child) ?? ""), value: text, type: leafType(child, text) })
      } else {
        walk(child, childPath)
      }
    }
    if (fields.length) {
      groups.push({ key: path.join("."), name: localName(tagOf(node) ?? ""), fields })
    }
  }

  roots.forEach((root, index) => {
    if (tagOf(root)) walk(root, [index])
  })
  // A parent's group is pushed after its nested children's — re-sort so sections follow document order.
  return groups.sort((a, b) => comparePaths(a.key, b.key))
}

function comparePaths(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1
    if (pb[i] === undefined) return 1
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

/** Sets the text of the leaf at `path` (from listXmlLeafGroups) and returns the re-serialized XML.
 *  A filled value drops the element's `nil` attribute, which would otherwise null it out. */
export function setXmlLeafValue(xml: string, path: number[], value: string): string {
  let roots: OrderedNode[]
  try {
    roots = parse(xml)
  } catch {
    return xml
  }
  let node: OrderedNode | undefined = roots[path[0]]
  for (const index of path.slice(1)) {
    node = node ? childrenOf(node)[index] : undefined
  }
  const tag = node ? tagOf(node) : null
  if (!node || !tag) return xml

  node[tag] = value === "" ? [] : [{ [TEXT]: value }]
  const attrs = node[ATTRS] as Record<string, unknown> | undefined
  if (attrs && value !== "") {
    for (const key of Object.keys(attrs)) {
      if (localName(key.replace(/^@_/, "")) === "nil") delete attrs[key]
    }
    if (Object.keys(attrs).length === 0) delete node[ATTRS]
  }
  return (builder.build(roots) as string).trim()
}
