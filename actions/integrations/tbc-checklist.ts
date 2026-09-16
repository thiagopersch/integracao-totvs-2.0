"use server"

import { tbcService } from "@/services/tbc.service"
import { soapService } from "@/services/soap.service"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { requirePermission } from "@/lib/rbac"
import { escapeXml, type SoapContext } from "@/utils/soap-envelope"
import { parseDataServerSchema, parseReadViewResult, type SchemaTable, type DataTable } from "@/utils/soap-schema"
import type { WsName } from "@/lib/ws-names"

export type ChecklistFieldRow = {
  table: string
  name: string
  caption: string
  isPrimaryKey: boolean
  configurado: boolean
  valor: string
}

export type ChecklistTableResult = {
  table: string
  fields: ChecklistFieldRow[]
}

/** coligada/filial/tipo de curso — same 3 fields the SOAP Builder always sends as Contexto. */
export type ChecklistContext = {
  coligate: number
  branch: number
  levelEducation: number
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
 * GetSchema (structure) + ReadView (real values, scoped by `filtro` — a SQL-like WHERE condition,
 * e.g. "SPSPROCESSOSELETIVO.CODCOLIGADA = 1 AND SPSPROCESSOSELETIVO.IDPS = '123'") for one Data
 * Server, merged field by field. A field is "configurado" when the first matching row has a
 * non-empty value for it. `context` (coligada/filial/tipo de curso) is always sent, mirroring the
 * SOAP Builder — TOTVS RM uses it internally to resolve the base before applying the filtro, and
 * omitting it is what causes "Object reference not set to an instance of an object.".
 */
export async function fetchDataserverChecklist(input: {
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
    const tables: SchemaTable[] = parseDataServerSchema(schemaRes.xmlResponse)
    if (!tables.length) {
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".` }
    }

    const filtro = input.filtro?.trim() ?? ""
    const readViewXml = filtro
      ? `<ReadView>\n  <DataServerName>${escapeXml(input.dataserverCode)}</DataServerName>\n  <Filtro>${escapeXml(filtro)}</Filtro>\n</ReadView>`
      : `<ReadView>\n  <DataServerName>${escapeXml(input.dataserverCode)}</DataServerName>\n</ReadView>`
    const viewRes = await soapService.execute(
      { tbc: credentials, wsName, method: "READVIEW", xml: readViewXml, context: soapContext },
      organizationId,
      userId
    )
    const dataTables: DataTable[] = parseReadViewResult(viewRes.xmlResponse)
    const rowsByTable = new Map(dataTables.map((t) => [t.name, t.rows[0]]))

    const result: ChecklistTableResult[] = tables.map((table) => {
      const firstRow = rowsByTable.get(table.name)
      const fields: ChecklistFieldRow[] = table.fields.map((field) => {
        const rawValue = firstRow?.[field.name] ?? ""
        return {
          table: table.name,
          name: field.name,
          caption: field.caption && field.caption !== "-" ? field.caption : field.name,
          isPrimaryKey: field.isPrimaryKey,
          configurado: rawValue.trim().length > 0,
          valor: rawValue,
        }
      })
      return { table: table.name, fields }
    })

    return { success: true as const, tables: result }
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
