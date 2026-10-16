"use server"

import { updateTag } from "next/cache";
import { projectTaskService } from "@/services/project-task.service";
import { auditService } from "@/services/audit.service";
import {
  checklistItemSchema,
  dependencySchema,
  moveTaskSchema,
  projectTaskPatchSchema,
  projectTaskSchema,
  quickTaskSchema,
  rescheduleTaskSchema,
  taskCommentSchema,
} from "@/schemas/project-task.schema";
import { requirePermission } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { formatBlockingReferences } from "@/lib/entity-relations";

const ENTITY = "ProjectTask";

/** Task mutations change the project's progress/health/hours too (list + header). */
function invalidate(projectId: string, taskId?: string) {
  updateTag(`project-tasks-${projectId}`);
  updateTag(`project-${projectId}`);
  updateTag("projects");
  if (taskId) updateTag(`project-task-${taskId}`);
}

function fail(error: unknown) {
  return { success: false as const, error: (error as Error).message };
}

export async function createProjectTask(projectId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "create");
  const parsed = projectTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  try {
    const { task, project } = await projectTaskService.create(projectId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "CREATE", entity: ENTITY, entityId: task.id, newData: { title: task.title, project: project.code } });
    invalidate(projectId);
    return { success: true, data: { id: task.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function quickCreateProjectTask(projectId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "create");
  const parsed = quickTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const { task, project } = await projectTaskService.quickCreate(projectId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "CREATE", entity: ENTITY, entityId: task.id, newData: { title: task.title, project: project.code }, notify: false });
    invalidate(projectId);
    return { success: true, data: { id: task.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateProjectTask(projectId: string, taskId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = projectTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  try {
    const { task, old, warning } = await projectTaskService.update(taskId, projectId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({
      action: "UPDATE",
      entity: ENTITY,
      entityId: taskId,
      oldData: { title: old.title, status: old.status, assigneeId: old.assigneeId, dueDate: old.dueDate },
      newData: { title: task.title, status: task.status, assigneeId: task.assigneeId, dueDate: task.dueDate },
      notify: false,
    });
    invalidate(projectId, taskId);
    return { success: true, warning };
  } catch (error) {
    return fail(error);
  }
}

/** Inline edit of one or more properties from the task sheet (Notion-style). */
export async function patchProjectTask(projectId: string, taskId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = projectTaskPatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const { task, old, warning } = await projectTaskService.patch(taskId, projectId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({
      action: "UPDATE",
      entity: ENTITY,
      entityId: taskId,
      oldData: { title: old.title, status: old.status, priority: old.priority, assigneeId: old.assigneeId, dueDate: old.dueDate },
      newData: { title: task.title, status: task.status, priority: task.priority, assigneeId: task.assigneeId, dueDate: task.dueDate },
      notify: false,
    });
    invalidate(projectId, taskId);
    return { success: true, warning };
  } catch (error) {
    return fail(error);
  }
}

export async function moveProjectTask(projectId: string, taskId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Movimento inválido" };
  try {
    const { task, old, stage, warning } = await projectTaskService.move(taskId, projectId, parsed.data, { organizationId, userId, allowedClientIds });
    if (old.stageId !== task.stageId) {
      await auditService.log({
        action: "MOVE",
        entity: ENTITY,
        entityId: taskId,
        oldData: { title: old.title, status: old.status },
        newData: { title: task.title, status: task.status, stage: stage.name },
        notify: false,
      });
    }
    invalidate(projectId, taskId);
    return { success: true, warning };
  } catch (error) {
    return fail(error);
  }
}

export async function rescheduleProjectTask(projectId: string, taskId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = rescheduleTaskSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datas inválidas" };
  try {
    const { task, old } = await projectTaskService.reschedule(taskId, projectId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({
      action: "RESCHEDULE",
      entity: ENTITY,
      entityId: taskId,
      oldData: { title: old.title, startDate: old.startDate, dueDate: old.dueDate },
      newData: { title: task.title, startDate: task.startDate, dueDate: task.dueDate },
      notify: false,
    });
    invalidate(projectId, taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteProjectTask(projectId: string, taskId: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "delete");
  try {
    const task = await projectTaskService.softDelete(taskId, projectId, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "DELETE", entity: ENTITY, entityId: taskId, oldData: { title: task.title } });
    invalidate(projectId, taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function bulkDeleteProjectTasks(projectId: string, ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "delete");
  try {
    const result = await projectTaskService.bulkSoftDelete(ids, projectId, { organizationId, userId, allowedClientIds });
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: ENTITY,
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) await auditService.logBulkDeleteBlocked(ENTITY, result.blocked, organizationId, userId);
    invalidate(projectId);
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return fail(error);
  }
}

// ── Dependencies ─────────────────────────────────────────────────────────────

export async function addTaskDependency(projectId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = dependencySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dependência inválida" };
  try {
    const dependency = await projectTaskService.addDependency(projectId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "CREATE", entity: "ProjectTaskDependency", entityId: dependency.id, newData: parsed.data, notify: false });
    invalidate(projectId, parsed.data.successorId);
    updateTag(`project-task-${parsed.data.predecessorId}`);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeTaskDependency(projectId: string, dependencyId: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  try {
    const dependency = await projectTaskService.removeDependency(projectId, dependencyId, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "DELETE", entity: "ProjectTaskDependency", entityId: dependencyId, notify: false });
    invalidate(projectId, dependency.successorId);
    updateTag(`project-task-${dependency.predecessorId}`);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

// ── Checklist ────────────────────────────────────────────────────────────────

export async function addChecklistItem(projectId: string, taskId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Item inválido" };
  try {
    await projectTaskService.addChecklistItem(taskId, projectId, parsed.data.title, { organizationId, userId, allowedClientIds });
    invalidate(projectId, taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateChecklistItem(projectId: string, itemId: string, data: { done?: boolean; title?: string }) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const payload: { done?: boolean; title?: string } = {};
  if (typeof data?.done === "boolean") payload.done = data.done;
  if (data?.title !== undefined) {
    const parsed = checklistItemSchema.safeParse({ title: data.title });
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Item inválido" };
    payload.title = parsed.data.title;
  }
  try {
    const item = await projectTaskService.updateChecklistItem(itemId, projectId, payload, { organizationId, userId, allowedClientIds });
    invalidate(projectId, item.taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteChecklistItem(projectId: string, itemId: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  try {
    const item = await projectTaskService.deleteChecklistItem(itemId, projectId, { organizationId, userId, allowedClientIds });
    invalidate(projectId, item.taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

// ── Comments ─────────────────────────────────────────────────────────────────

export async function addTaskComment(projectId: string, taskId: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("project_tasks", "update");
  const parsed = taskCommentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Comentário inválido" };
  try {
    const comment = await projectTaskService.addComment(taskId, projectId, parsed.data.content, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "CREATE", entity: "ProjectTaskComment", entityId: comment.id, notify: false });
    invalidate(projectId, taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTaskComment(projectId: string, commentId: string) {
  const { organizationId, userId, allowedClientIds, permissions } = await requirePermission("project_tasks", "update");
  try {
    const comment = await projectTaskService.deleteComment(
      commentId,
      projectId,
      { organizationId, userId, allowedClientIds },
      hasPermission(permissions, "project_tasks", "delete")
    );
    await auditService.log({ action: "DELETE", entity: "ProjectTaskComment", entityId: commentId, notify: false });
    invalidate(projectId, comment.taskId);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

/** Tasks of a project for the demand form ("Tarefa" picker). */
export async function listProjectTasksForDemand(projectId: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("demands", "create");
  try {
    return await projectTaskService.listForDemand(projectId, { organizationId, userId, allowedClientIds });
  } catch {
    return [];
  }
}
