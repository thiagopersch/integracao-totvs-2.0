"use server"

import { updateTag } from "next/cache"
import { auditService } from "@/services/audit.service"
import {
  tbcChecklistService,
  type TbcChecklistImportSource,
  type TbcChecklistView,
} from "@/services/tbc-checklist.service"
import {
  tbcChecklistAddProcessosSchema,
  tbcChecklistDataserverFieldsSchema,
  tbcChecklistImportSchema,
  tbcChecklistListingSchema,
  tbcChecklistNameSchema,
} from "@/schemas/tbc-checklist.schema"
import { requirePermission } from "@/lib/rbac"

/** CRUD of the saved checklists of a TBC (which Data Servers/fields to validate + the screen's
 *  Contexto/listing setup). Reading them is `tbcs:read` (page query); changing them `tbcs:update`. */

type ChecklistResult = { success: true; data: TbcChecklistView } | { success: false; error: string }

async function mutate(
  run: (ctx: { organizationId: string; allowedClientIds: string[] }) => Promise<TbcChecklistView>,
  audit: (checklist: TbcChecklistView) => Parameters<typeof auditService.log>[0]
): Promise<ChecklistResult> {
  try {
    const { organizationId, allowedClientIds } = await requirePermission("tbcs", "update")
    const checklist = await run({ organizationId, allowedClientIds })
    await auditService.log(audit(checklist))
    updateTag(`tbc-checklists-${checklist.tbcId}`)
    return { success: true, data: checklist }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

function invalid(error: { issues: { message: string }[] }): ChecklistResult {
  return { success: false, error: error.issues[0]?.message ?? "Dados inválidos" }
}

export async function createTbcChecklist(tbcId: string, name: string): Promise<ChecklistResult> {
  const parsed = tbcChecklistNameSchema.safeParse({ name })
  if (!parsed.success) return invalid(parsed.error)
  return mutate(
    (ctx) => tbcChecklistService.create(tbcId, parsed.data.name, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "CREATE", entity: "TbcChecklist", entityId: c.id, newData: { name: c.name, tbcId: c.tbcId } })
  )
}

export async function renameTbcChecklist(id: string, name: string): Promise<ChecklistResult> {
  const parsed = tbcChecklistNameSchema.safeParse({ name })
  if (!parsed.success) return invalid(parsed.error)
  return mutate(
    (ctx) => tbcChecklistService.rename(id, parsed.data.name, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "UPDATE", entity: "TbcChecklist", entityId: c.id, newData: { name: c.name } })
  )
}

export async function deleteTbcChecklist(id: string): Promise<ChecklistResult> {
  return mutate(
    (ctx) => tbcChecklistService.softDelete(id, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "DELETE", entity: "TbcChecklist", entityId: c.id, oldData: { name: c.name, tbcId: c.tbcId } })
  )
}

export async function saveTbcChecklistListing(id: string, input: unknown): Promise<ChecklistResult> {
  const parsed = tbcChecklistListingSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return mutate(
    (ctx) => tbcChecklistService.updateListing(id, parsed.data, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "UPDATE", entity: "TbcChecklist", entityId: c.id, newData: { ...parsed.data } })
  )
}

export async function saveTbcChecklistDataserverFields(id: string, input: unknown): Promise<ChecklistResult> {
  const parsed = tbcChecklistDataserverFieldsSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return mutate(
    (ctx) => tbcChecklistService.upsertDataserver(id, parsed.data, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({
      action: "UPDATE",
      entity: "TbcChecklist",
      entityId: c.id,
      newData: { dataserverCode: parsed.data.dataserverCode, fieldCount: parsed.data.fields.length },
    })
  )
}

export async function removeTbcChecklistDataserver(id: string, dataserverCode: string): Promise<ChecklistResult> {
  return mutate(
    (ctx) => tbcChecklistService.removeDataserver(id, dataserverCode, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "UPDATE", entity: "TbcChecklist", entityId: c.id, oldData: { dataserverCode } })
  )
}

export async function addTbcChecklistProcessos(id: string, input: unknown): Promise<ChecklistResult> {
  const parsed = tbcChecklistAddProcessosSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return mutate(
    (ctx) => tbcChecklistService.addProcessos(id, parsed.data, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({
      action: "UPDATE",
      entity: "TbcChecklist",
      entityId: c.id,
      newData: { processosAdded: parsed.data.processos.map((p) => ({ codColigada: p.codColigada, idps: p.idps, name: p.name })) },
    })
  )
}

export async function removeTbcChecklistProcesso(id: string, processoId: string): Promise<ChecklistResult> {
  return mutate(
    (ctx) => tbcChecklistService.removeProcesso(id, processoId, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "UPDATE", entity: "TbcChecklist", entityId: c.id, oldData: { processoId } })
  )
}

/** Checklists (of any TBC the caller can reach) whose structure `targetId` can import — never
 *  `targetId` itself. Scope comes from the session, not from arguments. */
export async function listTbcChecklistImportSources(
  targetId: string
): Promise<{ success: true; data: TbcChecklistImportSource[] } | { success: false; error: string }> {
  try {
    const { organizationId, allowedClientIds } = await requirePermission("tbcs", "read")
    return { success: true, data: await tbcChecklistService.listImportSources(targetId, organizationId, allowedClientIds) }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function importTbcChecklistStructure(targetId: string, input: unknown): Promise<ChecklistResult> {
  const parsed = tbcChecklistImportSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  return mutate(
    (ctx) => tbcChecklistService.importStructure(targetId, parsed.data, ctx.organizationId, ctx.allowedClientIds),
    (c) => ({ action: "IMPORT", entity: "TbcChecklist", entityId: c.id, newData: { sourceId: parsed.data.sourceId, mode: parsed.data.mode } })
  )
}
