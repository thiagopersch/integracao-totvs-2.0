"use server"

import { updateTag } from "next/cache";
import { projectTimeEntryService } from "@/services/project-time-entry.service";
import { contractUsageService, type UsageCheckItem } from "@/services/contract-usage.service";
import { auditService } from "@/services/audit.service";
import { timeEntrySchema } from "@/schemas/project-task.schema";
import { requirePermission } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

const ENTITY = "ProjectTimeEntry";

/** Hours feed the task, the project (hours/health), and — via the contract — consumption. */
function invalidate(projectId: string, taskIds: string[], usageItems: UsageCheckItem[], organizationId: string) {
  updateTag(`project-tasks-${projectId}`);
  updateTag(`project-${projectId}`);
  updateTag("projects");
  for (const taskId of new Set(taskIds)) updateTag(`project-task-${taskId}`);
  if (usageItems.length) {
    contractUsageService.scheduleCheck(organizationId, usageItems);
    updateTag("contracts");
    updateTag("dashboard");
  }
}

export async function createTimeEntry(projectId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds, permissions } = await requirePermission("project_time_entries", "create");
  const parsed = timeEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const { entry, task, usageItems } = await projectTimeEntryService.create(
      projectId,
      parsed.data,
      { organizationId, userId, allowedClientIds },
      hasPermission(permissions, "projects", "update")
    );
    await auditService.log({
      action: "LOG_TIME",
      entity: ENTITY,
      entityId: entry.id,
      newData: { title: task.title, minutes: entry.minutes, date: entry.date },
      notify: false,
    });
    invalidate(projectId, [entry.taskId], usageItems, organizationId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTimeEntry(projectId: string, entryId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds, permissions } = await requirePermission("project_time_entries", "update");
  const parsed = timeEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const { entry, old, usageItems } = await projectTimeEntryService.update(
      entryId,
      projectId,
      parsed.data,
      { organizationId, userId, allowedClientIds },
      hasPermission(permissions, "projects", "update")
    );
    await auditService.log({
      action: "UPDATE",
      entity: ENTITY,
      entityId: entryId,
      oldData: { minutes: old.minutes, date: old.date },
      newData: { minutes: entry.minutes, date: entry.date },
      notify: false,
    });
    invalidate(projectId, [old.taskId, entry.taskId], usageItems, organizationId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTimeEntry(projectId: string, entryId: string) {
  const { organizationId, userId, allowedClientIds, permissions } = await requirePermission("project_time_entries", "delete");
  try {
    const { old, usageItems } = await projectTimeEntryService.softDelete(
      entryId,
      projectId,
      { organizationId, userId, allowedClientIds },
      hasPermission(permissions, "projects", "update")
    );
    await auditService.log({ action: "DELETE", entity: ENTITY, entityId: entryId, oldData: { minutes: old.minutes, date: old.date }, notify: false });
    invalidate(projectId, [old.taskId], usageItems, organizationId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
