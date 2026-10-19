import { createDemand } from "@/actions/demands"
import { createClient } from "@/actions/admin/clients"
import { createAnalyst } from "@/actions/analysts"
import { createRequester } from "@/actions/requesters"
import { createDepartment } from "@/actions/departments"
import { createDemandType } from "@/actions/demand-types"
import { createTag } from "@/actions/tags"
import { createContract } from "@/actions/contracts"
import { createProject } from "@/actions/projects"
import { createProjectTask } from "@/actions/project-tasks"
import { createCustomFieldDefinition } from "@/actions/custom-fields"
import { getDefaultTaskStageId } from "@/actions/ai-assistant"
import { AI_ENTITIES, type AiEntityKey } from "@/lib/ai/entities"

export interface CreateResult {
  success: boolean
  id?: string
  error?: string
  /** Field → first message, from the action's zod errors. */
  errors?: Record<string, string>
}

/** Action results shaped `{ success, data?: { id }, error?, errors?: fieldErrors }`. */
type ActionResult = { success: boolean; data?: unknown; error?: string; errors?: unknown }

/** The FormData-based actions read the same keys as their forms; arrays become repeated keys (like the forms' multi-selects). */
function toFormData(input: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) fd.append(key, String(item))
      continue
    }
    if (value === undefined || value === null || typeof value === "object") continue
    fd.append(key, String(value))
  }
  return fd
}

function normalize(result: ActionResult): CreateResult {
  if (result.success) return { success: true, id: (result.data as { id?: string } | undefined)?.id }
  const errors = Object.fromEntries(
    Object.entries((result.errors as Record<string, string[] | undefined>) ?? {}).map(([k, v]) => [k, v?.[0] ?? ""])
  )
  return { success: false, error: result.error ?? "Erro ao criar o registro", errors }
}

/**
 * Creates one confirmed proposal through the entity's regular create action (same guards,
 * validation, audit log and cache invalidation as the forms). `values` must have refs resolved.
 */
export async function createRecord(entity: AiEntityKey, values: Record<string, string>): Promise<CreateResult> {
  const input = AI_ENTITIES[entity].toInput(values)
  switch (entity) {
    case "demand":
      return normalize(await createDemand(toFormData(input)))
    case "client":
      return normalize(await createClient(toFormData(input)))
    case "analyst":
      return normalize(await createAnalyst(toFormData(input)))
    case "requester":
      return normalize(await createRequester(toFormData(input)))
    case "department":
      return normalize(await createDepartment(toFormData(input)))
    case "demandType":
      return normalize(await createDemandType(toFormData(input)))
    case "tag":
      return normalize(await createTag(toFormData(input)))
    case "contract":
      return normalize(await createContract(toFormData(input)))
    case "project":
      return normalize(await createProject(input))
    case "customField":
      return normalize(await createCustomFieldDefinition(input))
    case "projectTask": {
      let stageId = values.stageId
      if (!stageId) {
        const stage = await getDefaultTaskStageId(values.projectId)
        if (!stage.success) return { success: false, error: stage.error }
        stageId = stage.data
      }
      return normalize(await createProjectTask(values.projectId, { ...input, stageId }))
    }
  }
}
