"use server"

import { extractText, getDocumentProxy } from "unpdf"
import { tbcService } from "@/services/tbc.service"
import { soapService, SoapPermissionDeniedError } from "@/services/soap.service"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { requirePermission } from "@/lib/rbac"
import { escapeXml, type SoapContext } from "@/utils/soap-envelope"
import { parseReadViewResult } from "@/utils/soap-schema"
import type { WsName } from "@/lib/ws-names"
import { parsePermissionReport, type ParsedReportProfile } from "@/lib/tbc-permission-report"
import { PERMISSION_SENTENCE } from "@/config/tbc-permission-sentence"
import type { ChecklistContext } from "@/actions/integrations/tbc-checklist"

export type DataserverCheckStatus = "ok" | "denied" | "error"

export type DataserverCheckResult = {
  status: DataserverCheckStatus
  /** TOTVS message (denied/error) or what was checked. */
  message?: string
  duration: number
}

/** ReadView filtro that matches no row — proves read access without pulling data. */
const EMPTY_FILTRO = "1=0"

/**
 * Checks that the TBC user can read one Data Server, with read-only calls only: GetSchema +
 * ReadView (filtro `1=0`). `SoapPermissionDeniedError` (already logged by soapService) → "denied";
 * any other failure → "error".
 */
export async function validateTbcDataserver(input: {
  tbcId: string
  dataserverCode: string
  context?: ChecklistContext
}): Promise<DataserverCheckResult> {
  const started = Date.now()
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
    const credentials = await tbcService.getCredentialsForRequest(input.tbcId, organizationId, allowedClientIds)
    const wsName = (await soapEndpointService.getActiveTypeByKey("dataserver")).suffix as WsName
    const context: SoapContext = { ...input.context, user: credentials.user }
    const ds = escapeXml(input.dataserverCode)

    await soapService.execute(
      { tbc: credentials, wsName, method: "GETSCHEMA", xml: `<GetSchema>\n  <DataServerName>${ds}</DataServerName>\n</GetSchema>`, context },
      organizationId,
      userId
    )
    await soapService.execute(
      {
        tbc: credentials,
        wsName,
        method: "READVIEW",
        xml: `<ReadView>\n  <DataServerName>${ds}</DataServerName>\n  <Filtro>${EMPTY_FILTRO}</Filtro>\n</ReadView>`,
        context,
      },
      organizationId,
      userId
    )
    return { status: "ok", message: "GetSchema e ReadView autorizados.", duration: Date.now() - started }
  } catch (error) {
    return {
      status: error instanceof SoapPermissionDeniedError ? "denied" : "error",
      message: (error as Error).message,
      duration: Date.now() - started,
    }
  }
}

export type TbcUserProfileLink = {
  codColigada: string
  codSistema: string
  supervisor: boolean
  codPerfil: string | null
  nomePerfil: string | null
}

/** RM's reply when the sentence code isn't registered — e.g. "Não foi possível encontrar a consulta
 *  SQL utilizando a seguinte chave: 0|G|RUBEUS.PERFIS.TBC" (wording varies a little between releases). */
const SENTENCE_MISSING = /senten[çc]a|consulta/i
const NOT_FOUND = /encontr|n[ãa]o existe|inexistente/i

/**
 * Profiles the TBC user has in each system/coligada (GPERMIS + GUSRPERFIL + GPERFIL), through the
 * Consulta SQL in `PERMISSION_SENTENCE`. `sentenceMissing` = the client hasn't registered it yet.
 */
export async function fetchTbcUserProfiles(input: { tbcId: string }) {
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read")
    const credentials = await tbcService.getCredentialsForRequest(input.tbcId, organizationId, allowedClientIds)
    const wsName = (await soapEndpointService.getActiveTypeByKey("consulta")).suffix as WsName
    const s = PERMISSION_SENTENCE

    const res = await soapService.execute(
      {
        tbc: credentials,
        wsName,
        method: "REALIZARCONSULTASQL",
        xml: `<RealizarConsultaSQL>\n  <codSentenca>${escapeXml(s.codSentenca)}</codSentenca>\n  <codColigada>${s.codColigada}</codColigada>\n  <codSistema>${s.codSistema}</codSistema>\n  <parameters>${escapeXml(`CODUSUARIO=${credentials.user}`)}</parameters>\n</RealizarConsultaSQL>`,
        context: { user: credentials.user },
      },
      organizationId,
      userId
    )
    const rows = parseReadViewResult(res.xmlResponse).flatMap((t) => t.rows)
    const links: TbcUserProfileLink[] = rows.map((r) => ({
      codColigada: r.CODCOLIGADA ?? "",
      codSistema: r.CODSISTEMA ?? "",
      supervisor: r.SUPERVISOR === "1" || r.SUPERVISOR?.toUpperCase() === "T",
      codPerfil: r.CODPERFIL || null,
      nomePerfil: r.NOMEPERFIL || null,
    }))
    return { success: true as const, user: credentials.user, links }
  } catch (error) {
    const message = (error as Error).message
    return {
      success: false as const,
      error: message,
      permissionDenied: error instanceof SoapPermissionDeniedError,
      sentenceMissing: SENTENCE_MISSING.test(message) && NOT_FOUND.test(message),
    }
  }
}

const MAX_REPORT_BYTES = 5 * 1024 * 1024

/**
 * Reads one or more "Relatório de permissões dos perfis" PDFs exported from the client's RM and
 * returns every profile found in them. Nothing is stored — the comparison runs on the screen.
 */
export async function readPermissionReports(formData: FormData) {
  try {
    await requirePermission("tbcs", "read")
    const files = formData.getAll("files").filter((f): f is File => f instanceof File)
    if (!files.length) return { success: false as const, error: "Selecione ao menos um PDF." }

    const profiles: (ParsedReportProfile & { fileName: string })[] = []
    const skipped: string[] = []
    for (const file of files) {
      if (file.type !== "application/pdf" || file.size > MAX_REPORT_BYTES) {
        skipped.push(`${file.name} (não é PDF ou passa de 5 MB)`)
        continue
      }
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
      const { text } = await extractText(pdf, { mergePages: true })
      const found = parsePermissionReport(text)
      if (!found.length) skipped.push(`${file.name} (não é um Relatório de permissões dos perfis)`)
      profiles.push(...found.map((p) => ({ ...p, fileName: file.name })))
    }
    return { success: true as const, profiles, skipped }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
