"use server"

import { tbcService } from "@/services/tbc.service"
import { soapService } from "@/services/soap.service"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { requirePermission } from "@/lib/rbac"
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

/**
 * GetSchema (structure) + ReadView (real values, scoped by `filtro` — the exact TOTVS ReadView
 * filter expression, e.g. "CODCOLIGADA=1;CODPROCESSO=123") for one Data Server, merged field by
 * field. A field is "configurado" when the first matching row has a non-empty value for it.
 */
export async function fetchDataserverChecklist(input: { tbcId: string; dataserverCode: string; filtro?: string }) {
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
    const credentials = await tbcService.getCredentialsForRequest(input.tbcId, organizationId, allowedClientIds)
    const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver")
    const wsName = dataserverType.suffix as WsName

    const schemaRes = await soapService.execute(
      { tbc: credentials, wsName, method: "GETSCHEMA", xml: `<GetSchema>\n  <DataServerName>${input.dataserverCode}</DataServerName>\n</GetSchema>` },
      organizationId,
      userId
    )
    const tables: SchemaTable[] = parseDataServerSchema(schemaRes.xmlResponse)
    if (!tables.length) {
      return { success: false as const, error: `Nenhuma tabela encontrada no schema do Data Server "${input.dataserverCode}".` }
    }

    const filtro = input.filtro?.trim() ?? ""
    const readViewXml = filtro
      ? `<ReadView>\n  <DataServerName>${input.dataserverCode}</DataServerName>\n  <Filtro>${filtro}</Filtro>\n</ReadView>`
      : `<ReadView>\n  <DataServerName>${input.dataserverCode}</DataServerName>\n</ReadView>`
    const viewRes = await soapService.execute(
      { tbc: credentials, wsName, method: "READVIEW", xml: readViewXml },
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
export async function fetchDataserverRows(input: { tbcId: string; dataserverCode: string; filtro?: string }) {
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
    const credentials = await tbcService.getCredentialsForRequest(input.tbcId, organizationId, allowedClientIds)
    const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver")
    const wsName = dataserverType.suffix as WsName

    const schemaRes = await soapService.execute(
      { tbc: credentials, wsName, method: "GETSCHEMA", xml: `<GetSchema>\n  <DataServerName>${input.dataserverCode}</DataServerName>\n</GetSchema>` },
      organizationId,
      userId
    )
    const tables = parseDataServerSchema(schemaRes.xmlResponse)

    const filtro = input.filtro?.trim() ?? ""
    const readViewXml = filtro
      ? `<ReadView>\n  <DataServerName>${input.dataserverCode}</DataServerName>\n  <Filtro>${filtro}</Filtro>\n</ReadView>`
      : `<ReadView>\n  <DataServerName>${input.dataserverCode}</DataServerName>\n</ReadView>`
    const viewRes = await soapService.execute(
      { tbc: credentials, wsName, method: "READVIEW", xml: readViewXml },
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
