"use server"

import { tbcService } from "@/services/tbc.service"
import { soapService } from "@/services/soap.service"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { requirePermission } from "@/lib/rbac"
import { escapeXml, type SoapContext } from "@/utils/soap-envelope"
import { parseDataServerSchema, parseReadViewResult, type SchemaTable, type DataTable } from "@/utils/soap-schema"
import type { WsName } from "@/lib/ws-names"
import { buildPkFiltro, pickKnownPkValues } from "@/lib/tbc-checklist-filtro"
import { isConfiguredValue } from "@/lib/tbc-checklist-values"

export type ChecklistFieldRow = {
  table: string
  name: string
  caption: string
  isPrimaryKey: boolean
  configurado: boolean
  valor: string
}

/** One matched row for a table — a table can have more than one when the filtro is scoped to a
 *  broader key (e.g. coligada+IDPS) that several rows share (N áreas ofertadas for 1 processo). */
export type ChecklistRecord = {
  key: string
  label: string
  fields: ChecklistFieldRow[]
}

export type ChecklistTableResult = {
  table: string
  records: ChecklistRecord[]
  /** TOTVS returned no row for this table — `records` then holds one blank record (every field
   *  "Não configurado") so the checklist still shows what would need configuring. */
  empty: boolean
}

/** Name/caption/PK flag of one schema field — what the client keeps to render a table's tab. */
export type ChecklistFieldMeta = {
  name: string
  caption: string
  isPrimaryKey: boolean
}

export type ChecklistTableMeta = {
  name: string
  fields: ChecklistFieldMeta[]
}

/** One row of a Data Server's main table, addressable by `ReadRecord` (`primaryKey` = its PK
 *  values in schema order joined by ";", e.g. "1;1052") to load its related (child) tables. */
export type ChecklistParent = {
  key: string
  label: string
  primaryKey: string
  /** Set when this row's ReadRecord failed — its main-table fields then come from the (partial)
   *  ReadView row instead. */
  error?: string
}

/** Related tables' records under one parent row (e.g. SPSFormaInscricaoPS of the processo, or the
 *  documentos exigidos of one área ofertada), keyed by table name. */
export type ChecklistRelatedGroup = {
  parentKey: string
  results: Record<string, ChecklistTableResult>
}

const NAME_FIELD_PATTERN = /^(NOME|DESCRICAO|DESC)/i

/** Picks a human label for one row of a table: prefers a "nome"/"descrição" column, then the first
 *  non-PK field with a real value, prefixed by the row's last PK value (its own id, e.g. IDPS or
 *  IDAREAOFERTADA); falls back to the PK values, then a plain ordinal — so every accordion item has
 *  something to show even for oddly-shaped tables. */
function pickRecordLabel(fields: ChecklistFieldMeta[], row: Record<string, string>, index: number): string {
  const hasValue = (name: string) => (row[name] ?? "").trim().length > 0
  const pkValues = fields.filter((f) => f.isPrimaryKey && hasValue(f.name)).map((f) => row[f.name])
  const nonPk = fields.filter((f) => !f.isPrimaryKey && hasValue(f.name))
  const nameField = nonPk.find((f) => NAME_FIELD_PATTERN.test(f.name) || /nome|descri/i.test(f.caption)) ?? nonPk[0]
  if (nameField) {
    const id = pkValues[pkValues.length - 1]
    return id ? `${id} - ${row[nameField.name]}` : row[nameField.name]
  }
  if (pkValues.length) return pkValues.join(" - ")
  return `Registro ${index + 1}`
}

function toFieldMeta(table: SchemaTable): ChecklistTableMeta {
  return {
    name: table.name,
    fields: table.fields.map((f) => ({
      name: f.name,
      caption: f.caption && f.caption !== "-" ? f.caption : f.name,
      isPrimaryKey: f.isPrimaryKey,
    })),
  }
}

/** Merges a table's schema fields with the rows TOTVS returned for it. A field is "configurado"
 *  per `isConfiguredValue` (any value but an unchecked "F" flag). No rows → one blank record,
 *  flagged `empty`. */
function buildTableResult(table: ChecklistTableMeta, rows: Record<string, string>[], keyPrefix = table.name): ChecklistTableResult {
  const effectiveRows = rows.length ? rows : [{}]
  return {
    table: table.name,
    empty: rows.length === 0,
    records: effectiveRows.map((row, index) => ({
      key: `${keyPrefix}-${index}`,
      label: pickRecordLabel(table.fields, row, index),
      fields: table.fields.map((field) => {
        const rawValue = row[field.name] ?? ""
        return {
          table: table.name,
          name: field.name,
          caption: field.caption,
          isPrimaryKey: field.isPrimaryKey,
          configurado: isConfiguredValue(rawValue),
          valor: rawValue,
        }
      }),
    })),
  }
}

/** Rows of `tableName` in a ReadView/ReadRecord result — matched case-insensitively, since the
 *  DataSet element name isn't guaranteed to share the GetSchema casing. */
function rowsForTable(dataTables: DataTable[], tableName: string): Record<string, string>[] {
  const target = tableName.toLowerCase()
  return dataTables.filter((t) => t.name.toLowerCase() === target).flatMap((t) => t.rows)
}

/** Value of `field` in `row`, matching the column name case-insensitively. */
function rowValue(row: Record<string, string>, field: string): string | undefined {
  const target = field.toLowerCase()
  for (const [key, value] of Object.entries(row)) {
    if (key.toLowerCase() === target) return value
  }
  return undefined
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** coligada/filial/tipo de curso — same 3 fields the SOAP Builder always sends as Contexto. */
export type ChecklistContext = {
  coligate: number
  branch: number
  levelEducation: number
}

/** Max main-table rows loaded per Data Server — each one costs a ReadRecord round-trip. */
const MAX_PARENTS = 50

/** Resolves the TBC credentials, the Data Server web service and the Contexto once, then runs
 *  any number of Data Server operations through the same auth-then-execute path. */
async function openDataserverSession(tbcId: string, context: ChecklistContext) {
  const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
  const credentials = await tbcService.getCredentialsForRequest(tbcId, organizationId, allowedClientIds)
  const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver")
  const wsName = dataserverType.suffix as WsName
  const soapContext: SoapContext = { ...context, user: credentials.user }

  async function run(method: "GETSCHEMA" | "READVIEW" | "READRECORD", xml: string) {
    const res = await soapService.execute({ tbc: credentials, wsName, method, xml, context: soapContext }, organizationId, userId)
    return res.xmlResponse
  }

  return {
    getSchema: (dataserverCode: string) =>
      run("GETSCHEMA", `<GetSchema>\n  <DataServerName>${escapeXml(dataserverCode)}</DataServerName>\n</GetSchema>`),
    readView: (dataserverCode: string, filtro: string) =>
      run(
        "READVIEW",
        filtro
          ? `<ReadView>\n  <DataServerName>${escapeXml(dataserverCode)}</DataServerName>\n  <Filtro>${escapeXml(filtro)}</Filtro>\n</ReadView>`
          : `<ReadView>\n  <DataServerName>${escapeXml(dataserverCode)}</DataServerName>\n</ReadView>`
      ),
    /** The record's whole DataSet — every column of the main table plus all its child tables
     *  (unlike ReadView, which only brings the columns of the Data Server's view). */
    readRecord: async (dataserverCode: string, primaryKey: string) =>
      parseReadViewResult(
        await run(
          "READRECORD",
          `<ReadRecord>\n  <DataServerName>${escapeXml(dataserverCode)}</DataServerName>\n  <PrimaryKey>${escapeXml(primaryKey)}</PrimaryKey>\n</ReadRecord>`
        )
      ),
  }
}

/**
 * Only `GetSchema` for one Data Server — used to discover its tables/fields (and primary keys) as
 * soon as a Data Server is picked, before any ReadView is run, so the filtro editor can be
 * pre-filled with a `TABLE.PKFIELD = ''` template. Same auth-then-check-then-execute path as
 * everything else (`soapService.execute`).
 */
export async function fetchDataserverSchema(input: { tbcId: string; dataserverCode: string; context?: ChecklistContext }) {
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
    const credentials = await tbcService.getCredentialsForRequest(input.tbcId, organizationId, allowedClientIds)
    const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver")
    const wsName = dataserverType.suffix as WsName
    const soapContext: SoapContext = { ...input.context, user: credentials.user }

    const schemaRes = await soapService.execute(
      {
        tbc: credentials,
        wsName,
        method: "GETSCHEMA",
        xml: `<GetSchema>\n  <DataServerName>${escapeXml(input.dataserverCode)}</DataServerName>\n</GetSchema>`,
        context: soapContext,
      },
      organizationId,
      userId
    )
    const tables = parseDataServerSchema(schemaRes.xmlResponse)
    if (!tables.length) {
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".` }
    }
    return { success: true as const, tables }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

/**
 * Loads a Data Server's MAIN table, scoped by known values: `pkValues` may carry e.g.
 * CODCOLIGADA/IDPS of the selected processo, or what the user typed in the PK inputs — only those
 * naming a main-table column (case-insensitive) and non-empty become the filtro
 * (`TABLE.FIELD = 'value' AND ...`). `context` (coligada/filial/tipo de curso) is always sent,
 * mirroring the SOAP Builder — TOTVS RM uses it to resolve the base before applying the filtro.
 *
 * ReadView only finds WHICH rows match: it returns just the columns of the Data Server's view
 * (13 of the 117 SPSProcessoSeletivo columns, for instance), so every other field would look "não
 * configurado". The values therefore come from one ReadRecord per matched row (`parents`), which
 * returns the full record. Related (child) tables are loaded per tab by
 * `fetchChecklistRelatedTable`.
 */
export async function fetchChecklistMainTable(input: {
  tbcId: string
  dataserverCode: string
  pkValues: Record<string, string>
  context: ChecklistContext
}) {
  try {
    const session = await openDataserverSession(input.tbcId, input.context)
    const tables = parseDataServerSchema(await session.getSchema(input.dataserverCode)).map(toFieldMeta)
    const mainTable = tables[0]
    if (!mainTable) {
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".` }
    }

    const pkFieldNames = mainTable.fields.filter((f) => f.isPrimaryKey).map((f) => f.name)
    // Matched against every main-table column (not only the PK), so e.g. the áreas ofertadas of a
    // processo are found by CODCOLIGADA + IDPS whether or not IDPS is part of that table's own key.
    const appliedFilter = Object.fromEntries(
      Object.entries(pickKnownPkValues(mainTable.fields.map((f) => f.name), input.pkValues)).filter(([, v]) => v.trim() !== "")
    )
    const filtro = buildPkFiltro(mainTable.name, appliedFilter)
    const allViewRows = rowsForTable(parseReadViewResult(await session.readView(input.dataserverCode, filtro)), mainTable.name)
    const truncated = allViewRows.length > MAX_PARENTS
    const viewRows = allViewRows.slice(0, MAX_PARENTS)

    if (!pkFieldNames.length) {
      // No primary key → no ReadRecord possible; the view columns are all there is.
      return {
        success: true as const,
        tables,
        mainTable: mainTable.name,
        pkFieldNames,
        appliedFilter,
        mainResult: buildTableResult(mainTable, viewRows),
        parents: [] as ChecklistParent[],
        truncated,
      }
    }

    const loaded = await mapWithLimit(viewRows, 4, async (viewRow) => {
      const primaryKey = pkFieldNames.map((name) => viewRow[name] ?? "").join(";")
      try {
        const fullRow = rowsForTable(await session.readRecord(input.dataserverCode, primaryKey), mainTable.name)[0]
        return { primaryKey, row: fullRow ?? viewRow, error: fullRow ? undefined : "ReadRecord não retornou o registro." }
      } catch (error) {
        return { primaryKey, row: viewRow, error: (error as Error).message }
      }
    })

    const mainResult = buildTableResult(mainTable, loaded.map((l) => l.row))
    const parents: ChecklistParent[] = loaded.map((l, index) => ({
      key: mainResult.records[index].key,
      label: mainResult.records[index].label,
      primaryKey: l.primaryKey,
      ...(l.error ? { error: l.error } : {}),
    }))

    return { success: true as const, tables, mainTable: mainTable.name, pkFieldNames, appliedFilter, mainResult, parents, truncated }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

/**
 * Lazily loads related (child) tables of a Data Server — e.g. SPSFormaInscricaoPS of
 * EduPSProcessoSeletivoData — when the tab showing them is opened. ReadRecord returns the record's
 * whole DataSet, child tables included, so it runs once per requested parent row (`parents`, from
 * `fetchChecklistMainTable` — only the área being viewed, or all of them) and keeps the rows of
 * each requested table. When `matchValues` (e.g. CODCOLIGADA + IDPS) name columns a table actually
 * has, its rows are also checked against them.
 */
export async function fetchChecklistRelatedTable(input: {
  tbcId: string
  dataserverCode: string
  tables: ChecklistTableMeta[]
  parents: ChecklistParent[]
  matchValues: Record<string, string>
  context: ChecklistContext
}) {
  try {
    if (!input.parents.length) {
      return {
        success: false as const,
        error: "Nenhum registro da tabela principal (ou Data Server sem chave primária) — não é possível carregar as tabelas relacionadas.",
      }
    }
    const session = await openDataserverSession(input.tbcId, input.context)
    const matchEntries = Object.entries(input.matchValues).filter(([, v]) => v.trim() !== "")
    const matches = (row: Record<string, string>) =>
      matchEntries.every(([field, expected]) => {
        const actual = rowValue(row, field)
        return actual === undefined || actual.trim() === expected.trim()
      })

    const groups: ChecklistRelatedGroup[] = await mapWithLimit(input.parents, 4, async (parent) => {
      const dataTables = await session.readRecord(input.dataserverCode, parent.primaryKey)
      return {
        parentKey: parent.key,
        results: Object.fromEntries(
          input.tables.map((table) => [
            table.name,
            buildTableResult(table, rowsForTable(dataTables, table.name).filter(matches), `${parent.key}-${table.name}`),
          ])
        ),
      }
    })

    return { success: true as const, groups }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

/**
 * Live-lists the rows of a Data Server via ReadView, for a Data Server the user has designated as
 * the "processo seletivo" catalog (fully configured by the user — code, id/label fields — since
 * this app has no such entity of its own, see plan). Returns raw rows plus the schema so the
 * caller can offer id/label field pickers.
 */
export async function fetchDataserverRows(input: {
  tbcId: string
  dataserverCode: string
  filtro?: string
  context?: ChecklistContext
}) {
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
    const credentials = await tbcService.getCredentialsForRequest(input.tbcId, organizationId, allowedClientIds)
    const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver")
    const wsName = dataserverType.suffix as WsName
    const soapContext: SoapContext = { ...input.context, user: credentials.user }

    const schemaRes = await soapService.execute(
      {
        tbc: credentials,
        wsName,
        method: "GETSCHEMA",
        xml: `<GetSchema>\n  <DataServerName>${escapeXml(input.dataserverCode)}</DataServerName>\n</GetSchema>`,
        context: soapContext,
      },
      organizationId,
      userId
    )
    const tables = parseDataServerSchema(schemaRes.xmlResponse)

    const filtro = input.filtro?.trim() ?? ""
    const readViewXml = filtro
      ? `<ReadView>\n  <DataServerName>${escapeXml(input.dataserverCode)}</DataServerName>\n  <Filtro>${escapeXml(filtro)}</Filtro>\n</ReadView>`
      : `<ReadView>\n  <DataServerName>${escapeXml(input.dataserverCode)}</DataServerName>\n</ReadView>`
    const viewRes = await soapService.execute(
      { tbc: credentials, wsName, method: "READVIEW", xml: readViewXml, context: soapContext },
      organizationId,
      userId
    )
    const dataTables = parseReadViewResult(viewRes.xmlResponse)
    const mainTable = dataTables[0]
    if (!mainTable) {
      return { success: false as const, error: `Nenhum registro retornado pelo Data Server "${input.dataserverCode}".` }
    }

    return {
      success: true as const,
      fields: (tables[0]?.fields ?? []).map((f) => ({
        name: f.name,
        caption: f.caption && f.caption !== "-" ? f.caption : f.name,
        isPrimaryKey: f.isPrimaryKey,
      })),
      columns: mainTable.columns,
      rows: mainTable.rows,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
