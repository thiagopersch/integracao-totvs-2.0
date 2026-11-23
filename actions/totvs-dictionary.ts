"use server"

import { updateTag } from "next/cache"
import { requirePermission } from "@/lib/rbac"
import { parseDictionaryKey } from "@/lib/totvs-dictionary"
import { dictionaryEntrySchema } from "@/schemas/totvs-dictionary.schema"
import { auditService } from "@/services/audit.service"
import { totvsDictionaryService } from "@/services/totvs-dictionary.service"

const ENTITY = "TotvsDictionaryColumn"

function entryFrom(formData: FormData) {
  return dictionaryEntrySchema.safeParse({
    table: formData.get("table"),
    column: formData.get("column"),
    description: formData.get("description") ?? "",
  })
}

export async function createDictionaryEntry(formData: FormData) {
  try {
    await requirePermission("totvs_dictionary", "create")
    const parsed = entryFrom(formData)
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    const entity = await totvsDictionaryService.create(parsed.data)
    await auditService.log({ action: "CREATE", entity: ENTITY, entityId: `${entity.table}.${entity.column}`, newData: { ...entity }, notify: false })
    updateTag("totvs-dictionary")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateDictionaryEntry(key: string, formData: FormData) {
  try {
    await requirePermission("totvs_dictionary", "update")
    const current = parseDictionaryKey(String(key))
    if (!current) return { success: false as const, error: "Registro inválido" }
    const parsed = entryFrom(formData)
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
    const { before, after } = await totvsDictionaryService.update(current, parsed.data)
    await auditService.log({ action: "UPDATE", entity: ENTITY, entityId: `${after.table}.${after.column}`, oldData: { ...before }, newData: { ...after }, notify: false })
    updateTag("totvs-dictionary")
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function deleteDictionaryEntry(key: string) {
  return bulkDeleteDictionaryEntries([key])
}

export async function bulkDeleteDictionaryEntries(keys: string[]) {
  try {
    await requirePermission("totvs_dictionary", "delete")
    const parsed = (Array.isArray(keys) ? keys : []).slice(0, 5000).map((k) => parseDictionaryKey(String(k))).filter((k): k is { table: string; column: string } => !!k)
    if (parsed.length === 0) return { success: false, error: "Nenhum registro selecionado" }
    const deletedCount = await totvsDictionaryService.remove(parsed)
    await auditService.log({
      action: parsed.length > 1 ? "BULK_DELETE" : "DELETE",
      entity: ENTITY,
      entityId: parsed.map((k) => `${k.table}.${k.column}`).join(",").slice(0, 1000),
      newData: { count: deletedCount },
      notify: false,
    })
    updateTag("totvs-dictionary")
    return { success: true, deletedCount, blocked: [] }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/** Table names for the "Tabela" filter (and the new-entry form). */
export async function searchDictionaryTables(search: string) {
  try {
    await requirePermission("totvs_dictionary", "read")
    return { success: true as const, tables: await totvsDictionaryService.searchTables(String(search ?? "").slice(0, 128)) }
  } catch (error) {
    return { success: false as const, error: (error as Error).message, tables: [] }
  }
}
