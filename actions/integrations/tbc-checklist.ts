"use server"

import { tbcService } from "@/services/tbc.service"
import { soapService, SoapPermissionDeniedError } from "@/services/soap.service"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { requirePermission } from "@/lib/rbac"
import { escapeXml, type SoapContext } from "@/utils/soap-envelope"
import { parseDataServerSchema, parseReadViewResult } from "@/utils/soap-schema"
import type { WsName } from "@/lib/ws-names"
import { buildPkFiltro, pickKnownPkValues } from "@/lib/tbc-checklist-filtro"
import { buildTableResult, rowsForTable, rowValue, toFieldMeta, type ChecklistMainRecord } from "@/lib/tbc-checklist-records"
import { findNameField, toProcessoOptions } from "@/lib/tbc-checklist-processos"

export type ChecklistFieldRow = {
  table: string
  name: string
  caption: string
  isPrimaryKey: boolean
  /** XSD type from GetSchema without prefix — "short", "int", "string", "dateTime", "base64Binary"… */
  type: string
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
  type: string
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

/** Every checklist action's failure shape. `permissionDenied` = the TBC user has no access to the
 *  Data Server in TOTVS (already logged by soapService) — the screen shows a dedicated message
 *  for it instead of a generic error. */
function failure(error: unknown) {
  return {
    success: false as const,
    error: (error as Error).message,
    permissionDenied: error instanceof SoapPermissionDeniedError,
  }
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
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".`, permissionDenied: false }
    }
    return { success: true as const, tables }
  } catch (error) {
    return failure(error)
  }
}

/**
 * Step 1 of loading a Data Server's MAIN table (the client then asks for the records in batches,
 * so it can show progress): GetSchema + ReadView, scoped by known values — `pkValues` may carry
 * e.g. CODCOLIGADA/IDPS of the selected processo; only those naming a main-table column
 * (case-insensitive) and non-empty become the filtro (`TABLE.FIELD = 'value' AND ...`). `context`
 * (coligada/filial/tipo de curso) is always sent, mirroring the SOAP Builder — TOTVS RM uses it to
 * resolve the base before applying the filtro.
 *
 * ReadView only finds WHICH rows match: it returns just the columns of the Data Server's view
 * (13 of the 117 SPSProcessoSeletivo columns, for instance), so every other field would look "não
 * configurado". The values therefore come from one ReadRecord per matched row
 * (`fetchChecklistMainRecords`, keyed by `primaryKeys`). With no primary key there is no
 * ReadRecord: `primaryKeys` is empty and the view columns are all there is.
 */
export async function fetchChecklistMainView(input: {
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
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".`, permissionDenied: false }
    }

    const pkFieldNames = mainTable.fields.filter((f) => f.isPrimaryKey).map((f) => f.name)
    // Matched against every main-table column (not only the PK), so e.g. the áreas ofertadas of a
    // processo are found by CODCOLIGADA + IDPS whether or not IDPS is part of that table's own key.
    const appliedFilter = Object.fromEntries(
      Object.entries(pickKnownPkValues(mainTable.fields.map((f) => f.name), input.pkValues)).filter(([, v]) => v.trim() !== "")
    )
    const filtro = buildPkFiltro(mainTable.name, appliedFilter)
    const allViewRows = rowsForTable(parseReadViewResult(await session.readView(input.dataserverCode, filtro)), mainTable.name)
    const viewRows = allViewRows.slice(0, MAX_PARENTS)
    const primaryKeys = pkFieldNames.length ? viewRows.map((row) => pkFieldNames.map((name) => row[name] ?? "").join(";")) : []

    return {
      success: true as const,
      tables,
      mainTable: mainTable.name,
      appliedFilter,
      viewRows,
      primaryKeys,
      truncated: allViewRows.length > MAX_PARENTS,
    }
  } catch (error) {
    return failure(error)
  }
}

/** Most ReadRecords one `fetchChecklistMainRecords` call runs — the client sends small batches. */
const MAX_RECORDS_PER_CALL = 10

/**
 * Step 2: the full main-table record (every column — unlike ReadView) of each primary key, one
 * ReadRecord each, at most 4 in flight. A failed row is reported in its slot (the client falls
 * back to its ReadView columns); no access to the Data Server fails the whole call.
 */
export async function fetchChecklistMainRecords(input: {
  tbcId: string
  dataserverCode: string
  context: ChecklistContext
  mainTable: string
  primaryKeys: string[]
}) {
  try {
    if (input.primaryKeys.length > MAX_RECORDS_PER_CALL) {
      return { success: false as const, error: `No máximo ${MAX_RECORDS_PER_CALL} registros por chamada.`, permissionDenied: false }
    }
    const session = await openDataserverSession(input.tbcId, input.context)
    const records: ChecklistMainRecord[] = await mapWithLimit(input.primaryKeys, 4, async (primaryKey) => {
      try {
        const row = rowsForTable(await session.readRecord(input.dataserverCode, primaryKey), input.mainTable)[0]
        return row ? { primaryKey, row } : { primaryKey, row: null, error: "ReadRecord não retornou o registro." }
      } catch (error) {
        // No access to this Data Server fails the whole load (shown as such), not just this row.
        if (error instanceof SoapPermissionDeniedError) throw error
        return { primaryKey, row: null, error: (error as Error).message }
      }
    })
    return { success: true as const, records }
  } catch (error) {
    return failure(error)
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
        permissionDenied: false,
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
    return failure(error)
  }
}

/**
 * Lists the processos seletivos of a Data Server (EduPSProcessoSeletivoData by default) so the user
 * can pick which ones the checklist keeps — only run when adding processos, never to show the
 * checklist. Scoped by the Contexto's coligada and, when given, one IDPS; empty IDPS = all of them.
 */
export async function searchProcessosSeletivos(input: {
  tbcId: string
  dataserverCode: string
  context: ChecklistContext
  idps?: string
}) {
  try {
    const idps = input.idps?.trim() ?? ""
    if (idps && !/^\d+$/.test(idps)) {
      return { success: false as const, error: "IDPS deve ser um número.", permissionDenied: false }
    }
    const session = await openDataserverSession(input.tbcId, input.context)
    const mainTable = parseDataServerSchema(await session.getSchema(input.dataserverCode))[0]
    if (!mainTable) {
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".`, permissionDenied: false }
    }
    const fieldNamed = (name: string) => mainTable.fields.find((f) => f.name.toUpperCase() === name)?.name
    const coligadaField = fieldNamed("CODCOLIGADA")
    const idpsField = fieldNamed("IDPS")
    if (!coligadaField || !idpsField) {
      return {
        success: false as const,
        error: `O Data Server "${input.dataserverCode}" não tem os campos CODCOLIGADA e IDPS — não é um Data Server de processos seletivos.`,
        permissionDenied: false,
      }
    }

    const filtro = buildPkFiltro(mainTable.name, {
      [coligadaField]: String(input.context.coligate),
      ...(idps ? { [idpsField]: idps } : {}),
    })
    const rows = rowsForTable(parseReadViewResult(await session.readView(input.dataserverCode, filtro)), mainTable.name)
    return { success: true as const, processos: toProcessoOptions(rows, findNameField(mainTable.fields), input.context) }
  } catch (error) {
    return failure(error)
  }
}
