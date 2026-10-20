import { unwrapData, asArray, type Raw } from "@/lib/ps-docs/api-helpers"
import { FIELD_TYPE_LABELS, parseFormBuild } from "@/lib/ps-docs/parse-structure"
import { classifyTotvsIntegration, type TotvsFieldAuditRow } from "@/lib/ps-docs/totvs-field-audit"
import type { TotvsAuditEvent } from "@/lib/ps-docs/field-search-stream"
import { ADMIN_API, settingsFieldsHeaders } from "./process-structure"
import { httpError, type RubeusClient } from "./rubeus-client"

const isAbort = (error: unknown) =>
  (error as Error)?.name === "AbortError" || (error as Error)?.name === "CanceledError"

function firstString(obj: Raw, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === "string" && value.trim() !== "") return value
    if (typeof value === "number") return String(value)
  }
  return undefined
}

function fieldId(item: Raw): number | undefined {
  const id = Number(item.field_id ?? item.id)
  return Number.isFinite(id) && id > 0 ? id : undefined
}

function toRow(id: number, item: Raw): TotvsFieldAuditRow {
  const formBuild = parseFormBuild(item.form_build)
  const type = firstString(formBuild, ["type"]) ?? firstString(item, ["type"]) ?? "—"
  return {
    id,
    nome: firstString(item, ["label", "name", "title"]) ?? firstString(formBuild, ["label"]) ?? `campo #${id}`,
    tipo: FIELD_TYPE_LABELS[type] ?? type,
    tabelaPs: item.ps_table === 1 ? "Inscrição" : item.ps_table === 0 ? "Pessoa" : undefined,
    ...classifyTotvsIntegration(item),
  }
}

export interface TotvsAuditStats {
  campos: number
  configurados: number
  incompletos: number
  naoConfigurados: number
  falhas: number
}

/** Reads every field of the registry (Definições → Campos, `GET /api/settings/fields`) and
 *  classifies its "Integração TOTVS". Confirmed live: that list carries `totvs_table` and
 *  `totvs_field` but NOT `totvs_alternative_name`, so each field's full record is read from
 *  `GET /api/settings/field/{field_id}` (the "Edição do campo" dialog) — the client caps
 *  concurrency. `/api/crm/fields` is NOT this registry: it lists the Rubeus CRM custom fields
 *  (`idCampoPersonalizado`), without any TOTVS mapping. */
export async function runTotvsFieldAudit(
  client: RubeusClient,
  emit: (event: TotvsAuditEvent) => void
): Promise<TotvsAuditStats> {
  emit({ type: "progress", label: "lendo o cadastro de campos", done: 0, total: 0 })
  const res = await client.get(`${ADMIN_API}/settings/fields`, { headers: settingsFieldsHeaders(), timeout: 60_000 })
  if (res.status >= 400) throw httpError(res.status, "settings/fields")

  const items = asArray(unwrapData(res.data)).filter((item) => fieldId(item) !== undefined)
  const stats: TotvsAuditStats = {
    campos: items.length,
    configurados: 0,
    incompletos: 0,
    naoConfigurados: 0,
    falhas: 0,
  }
  const count = (row: TotvsFieldAuditRow) => {
    if (row.status === "Configurado") stats.configurados++
    else if (row.status === "Incompleto") stats.incompletos++
    else stats.naoConfigurados++
  }

  let done = 0
  emit({ type: "progress", label: "campos verificados", done, total: items.length })
  await Promise.all(
    items.map(async (item) => {
      const id = fieldId(item)!
      const label = firstString(item, ["label"]) ?? `Campo #${id}`
      try {
        let record = item
        if (!("totvs_alternative_name" in item)) {
          const detail = await client.get(`${ADMIN_API}/settings/field/${id}`)
          if (detail.status >= 400) {
            stats.falhas++
            emit({ type: "warning", messages: [`${label} (${id}): falha ao consultar o campo (HTTP ${detail.status})`] })
            return
          }
          record = { ...item, ...(unwrapData(detail.data) as Raw) }
        }
        const row = toRow(id, record)
        count(row)
        emit({ type: "rows", rows: [row] })
      } catch (error) {
        if (isAbort(error)) throw error
        stats.falhas++
        emit({ type: "warning", messages: [`${label} (${id}): falha ao consultar o campo`] })
      } finally {
        done++
        emit({ type: "progress", label: "campos verificados", done, total: items.length })
      }
    })
  )
  emit({ type: "done", total: items.length })
  return stats
}
