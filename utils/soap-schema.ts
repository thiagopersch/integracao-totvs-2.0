import { XMLParser } from "fast-xml-parser"

export type SchemaField = {
  name: string
  caption: string
  type: string
  defaultValue: string
  maxLength: string
  isPrimaryKey: boolean
}

export type SchemaTable = {
  name: string
  fields: SchemaField[]
}

const schemaParser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  trimValues: true,
  // Real TOTVS DataSet XSDs write boolean flags as bare attributes — `msdata:PrimaryKey` and
  // `msdata:IsDataSet` with no `="true"` — which fast-xml-parser otherwise drops silently instead
  // of erroring, so primary keys would just go undetected rather than fail loudly.
  allowBooleanAttributes: true,
})

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Every namespace prefix TOTVS's WCF/DataSet serializers use ("xs", "msdata", "d2p1", "i", ...)
 *  is generated per-response and not guaranteed stable, so every lookup below matches by local
 *  (unprefixed) name instead of a hardcoded prefix. */
function localName(key: string): string {
  const idx = key.indexOf(":")
  return idx === -1 ? key : key.slice(idx + 1)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function childByLocalName(node: unknown, local: string): unknown {
  if (!isRecord(node)) return undefined
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue
    if (localName(key).toLowerCase() === local.toLowerCase()) return node[key]
  }
  return undefined
}

/** `$Caption`-style ADO.NET extended properties are XML-escaped to `_x0024_Caption` — stripped
 *  here so `getAttr(node, "Caption")` matches both the escaped and plain attribute forms. */
function normalizeAttrName(name: string): string {
  return localName(name)
    .replace(/_x0024_/gi, "")
    .toLowerCase()
}

function getAttr(node: unknown, ...wanted: string[]): string {
  if (!isRecord(node)) return ""
  const targets = wanted.map((w) => w.toLowerCase())
  for (const key of Object.keys(node)) {
    if (!key.startsWith("@_")) continue
    if (!targets.includes(normalizeAttrName(key.slice(2)))) continue
    const value = node[key]
    if (value !== undefined && value !== null && value !== "") return String(value)
  }
  return ""
}

function findFirstByLocalName(node: unknown, local: string, depth = 0): unknown {
  if (depth > 12 || !isRecord(node)) return undefined
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_") || key === "#text") continue
    if (localName(key).toLowerCase() === local.toLowerCase()) return value
    const found = findFirstByLocalName(value, local, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * Collects every node named `local` anywhere in the tree, at any depth — including nested inside
 * another match. TOTVS sometimes declares each DataSet table as its own top-level `xs:element`
 * referenced by `ref` from a root `choice` (the documented ADO.NET shape), and sometimes declares
 * them inline, nested directly inside that same root element's `choice` (seen live). Both need
 * every `xs:element` found regardless of nesting, so this must keep walking into a match's own
 * children too instead of stopping there.
 */
function findAllByLocalName(node: unknown, local: string, acc: unknown[] = [], depth = 0): unknown[] {
  if (depth > 20 || !isRecord(node)) return acc
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_") || key === "#text") continue
    if (localName(key).toLowerCase() === local.toLowerCase()) {
      asArray(value).forEach((v) => acc.push(v))
    }
    findAllByLocalName(value, local, acc, depth + 1)
  }
  return acc
}

function stripNsPrefix(type: string): string {
  return type.includes(":") ? type.slice(type.indexOf(":") + 1) : type
}

/**
 * Parses the ADO.NET DataSet-shaped XSD that `wsDataServer.GetSchema` returns (confirmed against
 * TOTVS's own TDN docs: `xs:element`/`xs:complexType`/`xs:sequence` per table, `msdata:Caption` or
 * the `$Caption`-escaped `msprop:_x0024_Caption` for field captions, `xs:unique` with
 * `msdata:PrimaryKey` (a bare boolean flag live, not `="true"` as TDN's own example shows) +
 * `xs:selector`/`xs:field` for primary keys). One root "container" element (a `choice` covering
 * every table, either by `ref` to top-level siblings per the ADO.NET docs, or — confirmed live —
 * with each table declared inline, nested directly inside the `choice` itself) is expected and
 * skipped; every OTHER `xs:element` with a field `sequence`, at any nesting depth, becomes one
 * table.
 */
export function parseDataServerSchema(xml: string): SchemaTable[] {
  try {
    const json = schemaParser.parse(xml) as Record<string, unknown>
    const schema = findFirstByLocalName(json, "schema")
    if (!isRecord(schema)) return []

    const allElements = findAllByLocalName(schema, "element")
    const tables: SchemaTable[] = []
    const seenTableNames = new Set<string>()

    for (const el of allElements) {
      const name = getAttr(el, "name")
      if (!name || seenTableNames.has(name)) continue
      const complexType = childByLocalName(el, "complexType")
      const sequence = childByLocalName(complexType, "sequence") ?? childByLocalName(complexType, "all")
      if (!isRecord(sequence)) continue // the root/choice container, or some other non-table shape

      const fieldEls = asArray(childByLocalName(sequence, "element")).filter((f) => getAttr(f, "name"))
      if (!fieldEls.length) continue

      const fields: SchemaField[] = fieldEls.map((f) => {
        const simpleType = childByLocalName(f, "simpleType")
        const restriction = childByLocalName(simpleType, "restriction")
        const maxLengthNode = childByLocalName(restriction, "maxLength")
        const type = getAttr(f, "type") || getAttr(restriction, "base") || "string"
        return {
          name: getAttr(f, "name"),
          caption: getAttr(f, "Caption"),
          type: stripNsPrefix(type),
          defaultValue: getAttr(f, "default"),
          maxLength: getAttr(maxLengthNode, "value"),
          isPrimaryKey: false,
        }
      })

      seenTableNames.add(name)
      tables.push({ name, fields })
    }

    const pkFieldsByTable = new Map<string, Set<string>>()
    for (const constraint of [...findAllByLocalName(schema, "unique"), ...findAllByLocalName(schema, "key")]) {
      if (getAttr(constraint, "PrimaryKey").toLowerCase() !== "true") continue
      const selectorPath = getAttr(childByLocalName(constraint, "selector"), "xpath")
      // xpath values are namespace-qualified live (e.g. `.//mstns:TableName`, `mstns:FIELD`) even
      // though the element/field names collected above never carry that prefix — strip it so the
      // two sides actually match.
      const tableName = stripNsPrefix(selectorPath.replace(/^\.\/\//, "").replace(/^\.\//, ""))
      if (!tableName) continue
      const fieldNames = asArray(childByLocalName(constraint, "field"))
        .map((f) => stripNsPrefix(getAttr(f, "xpath")))
        .filter(Boolean)
      const set = pkFieldsByTable.get(tableName) ?? new Set<string>()
      fieldNames.forEach((f) => set.add(f))
      pkFieldsByTable.set(tableName, set)
    }

    for (const table of tables) {
      const pkFields = pkFieldsByTable.get(table.name)
      if (!pkFields?.size) continue
      table.fields.forEach((f) => {
        f.isPrimaryKey = pkFields.has(f.name)
      })
      // Stable sort — primary keys first, everything else keeps its declared order.
      table.fields.sort((a, b) => Number(b.isPrimaryKey) - Number(a.isPrimaryKey))
    }

    return tables
  } catch {
    return []
  }
}

function inferType(value: string): string {
  if (value === "") return "string"
  if (/^-?\d+$/.test(value)) return "int"
  if (/^-?\d+\.\d+$/.test(value)) return "decimal"
  if (/^(true|false)$/i.test(value)) return "boolean"
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "dateTime"
  return "string"
}

const NA = "-"

/** Flattens one `_params`-style `KeyValueOfanyTypeanyType` array (the process's real input
 *  parameters) into one field per key — reused both when it's a direct child and when it sits
 *  behind an extra wrapper element (e.g. `Context._params.KeyValueOfanyTypeanyType`). */
function pushKeyValueFields(fields: SchemaField[], kvArray: unknown): void {
  for (const kv of asArray(kvArray)) {
    if (!isRecord(kv)) continue
    const keyNode = childByLocalName(kv, "Key")
    const valueNode = childByLocalName(kv, "Value")
    const keyText = isRecord(keyNode) ? String(keyNode["#text"] ?? "") : String(keyNode ?? "")
    const valueText = isRecord(valueNode) ? String(valueNode["#text"] ?? "") : String(valueNode ?? "")
    const valueType = isRecord(valueNode) ? stripNsPrefix(getAttr(valueNode, "type")) : ""
    fields.push({
      name: keyText,
      caption: NA,
      type: valueType || inferType(valueText),
      defaultValue: valueText,
      maxLength: NA,
      isPrimaryKey: false,
    })
  }
}

/**
 * `wsProcess.GetSchema` doesn't return an XSD at all — it returns one fully-populated sample
 * instance of the process's parameter object (WCF DataContract XML), confirmed against a real
 * response (EduMatricAprovadosPSData). There's no caption/maxLength/primary-key metadata to read,
 * so this walks the object graph instead: each complex object becomes its own "table" (mirroring
 * the dataserver view's related-tables idea), each scalar becomes a field whose "default value" is
 * the sample value actually present in the response, and the recurring `_params`
 * Key/Value pair list (the process's real input parameters) is flattened into one field per key.
 */
export function parseProcessSchema(xml: string): SchemaTable[] {
  try {
    const json = schemaParser.parse(xml) as Record<string, unknown>
    const rootKey = Object.keys(json)[0]
    const root = rootKey ? json[rootKey] : undefined
    if (!isRecord(root)) return []

    const tables: SchemaTable[] = []
    const usedNames = new Set<string>()

    function uniqueTableName(name: string): string {
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
      let i = 2
      while (usedNames.has(`${name} (${i})`)) i++
      const candidate = `${name} (${i})`
      usedNames.add(candidate)
      return candidate
    }

    function walk(nodeName: string, node: Record<string, unknown>, depth: number) {
      if (depth > 6 || tables.length > 40) return
      const fields: SchemaField[] = []
      const childTables: Array<{ name: string; node: Record<string, unknown> }> = []

      for (const [rawKey, value] of Object.entries(node)) {
        if (rawKey.startsWith("@_") || rawKey === "#text") continue
        const key = localName(rawKey)
        if (value === null || value === undefined) continue

        if (key === "KeyValueOfanyTypeanyType") {
          pushKeyValueFields(fields, value)
          continue
        }

        if (Array.isArray(value)) {
          const first = value[0]
          if (isRecord(first)) {
            childTables.push({ name: key, node: first })
          } else {
            fields.push({
              name: key,
              caption: NA,
              type: inferType(String(first ?? "")),
              defaultValue: String(first ?? ""),
              maxLength: NA,
              isPrimaryKey: false,
            })
          }
          continue
        }

        if (isRecord(value)) {
          const dataKeys = Object.keys(value).filter((k) => k !== "#text" && !k.startsWith("@_"))
          if (dataKeys.length === 0) {
            const isNil = getAttr(value, "nil").toLowerCase() === "true"
            const text = String(value["#text"] ?? "")
            fields.push({
              name: key,
              caption: NA,
              type: stripNsPrefix(getAttr(value, "type")) || (isNil ? "string" : inferType(text)),
              defaultValue: isNil ? "" : text,
              maxLength: NA,
              isPrimaryKey: false,
            })
            continue
          }
          // A single wrapped child (collection wrapper like <AlunosAprovados><Item>.. or a plain
          // nested complex object) — recurse using the inner element's own name as the table name.
          if (dataKeys.length === 1) {
            const inner = value[dataKeys[0]]
            const innerName = localName(dataKeys[0])
            if (innerName === "KeyValueOfanyTypeanyType") {
              pushKeyValueFields(fields, inner)
              continue
            }
            if (Array.isArray(inner)) {
              const first = inner[0]
              if (isRecord(first)) childTables.push({ name: innerName, node: first })
              continue
            }
            if (isRecord(inner)) {
              childTables.push({ name: innerName, node: inner })
              continue
            }
          }
          childTables.push({ name: key, node: value })
          continue
        }

        fields.push({
          name: key,
          caption: NA,
          type: inferType(String(value)),
          defaultValue: String(value),
          maxLength: NA,
          isPrimaryKey: false,
        })
      }

      tables.push({ name: uniqueTableName(nodeName), fields })
      for (const child of childTables) walk(child.name, child.node, depth + 1)
    }

    walk(localName(rootKey), root, 0)
    return tables
  } catch {
    return []
  }
}

export type DataTable = {
  name: string
  columns: string[]
  rows: Record<string, string>[]
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (isRecord(value)) return String(value["#text"] ?? "")
  return String(value)
}

/** A node "is a row" when every one of its children is a plain value — a scalar, or a nil-marked
 *  empty element (`<FIELD i:nil="true" />` parses to an object with only `#text`/`@_` keys) —
 *  never another nested structure. That's what distinguishes an actual data row (ReadView) from a
 *  DataSet's schema/container elements. */
function isDataRow(node: unknown): node is Record<string, unknown> {
  if (!isRecord(node)) return false
  return Object.entries(node).every(([key, value]) => {
    if (key.startsWith("@_")) return true
    if (value === null || value === undefined) return true
    if (typeof value !== "object") return true
    return Object.keys(value).every((k) => k === "#text" || k.startsWith("@_"))
  })
}

/**
 * Parses the ADO.NET DataSet-shaped XML `wsDataServer.ReadView` returns — same DataSet concept
 * `GetSchema` describes the structure of, just carrying the actual row values this time (root is
 * typically `NewDataSet`, wrapping one repeated element per row, per table — confirmed against the
 * shape `services/rm-sentence.service.ts` already reads live for GlbConsSqlData/ReadView). Rows are
 * matched structurally (see `isDataRow`) rather than against a hardcoded root/row name, so it
 * doesn't matter which table(s) the view actually touches, or whether TOTVS serializes a single
 * matching row as a bare object instead of a 1-item array (a known quirk).
 */
export function parseReadViewResult(xml: string): DataTable[] {
  try {
    const json = schemaParser.parse(xml) as Record<string, unknown>
    const rowsByTable = new Map<string, Record<string, string>[]>()
    const order: string[] = []

    function walk(node: unknown, depth: number) {
      if (depth > 20 || !isRecord(node)) return
      for (const [rawKey, value] of Object.entries(node)) {
        if (rawKey.startsWith("@_") || rawKey === "#text") continue
        const key = localName(rawKey)
        for (const item of asArray(value)) {
          if (isDataRow(item)) {
            const row: Record<string, string> = {}
            for (const [fieldKey, fieldValue] of Object.entries(item)) {
              if (fieldKey.startsWith("@_")) continue
              row[localName(fieldKey)] = cellText(fieldValue)
            }
            if (!rowsByTable.has(key)) {
              rowsByTable.set(key, [])
              order.push(key)
            }
            rowsByTable.get(key)!.push(row)
          } else {
            walk(item, depth + 1)
          }
        }
      }
    }

    walk(json, 0)

    return order.map((name) => {
      const rows = rowsByTable.get(name)!
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
      return { name, columns, rows }
    })
  } catch {
    return []
  }
}
