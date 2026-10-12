"use server"

import { updateTag } from "next/cache";
import { projectService } from "@/services/project.service";
import { auditService } from "@/services/audit.service";
import { projectLifecycleSchema, projectRiskSchema, projectSchema } from "@/schemas/project.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";

const ENTITY = "Project";

function invalidate(id?: string) {
  updateTag("projects");
  if (id) {
    updateTag(`project-${id}`);
    updateTag(`project-tasks-${id}`);
  }
}

export async function createProject(input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "create");
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const project = await projectService.create(parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "CREATE", entity: ENTITY, entityId: project.id, newData: { code: project.code, name: project.name } });
    invalidate();
    return { success: true, data: { id: project.id, code: project.code } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateProject(id: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "update");
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { project, old } = await projectService.update(id, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({
      action: "UPDATE",
      entity: ENTITY,
      entityId: id,
      oldData: { name: old.name, status: old.status, clientId: old.clientId, contractId: old.contractId, plannedEndDate: old.plannedEndDate },
      newData: { name: project.name, status: project.status, clientId: project.clientId, contractId: project.contractId, plannedEndDate: project.plannedEndDate },
    });
    invalidate(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setProjectLifecycleStatus(id: string, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "update");
  const parsed = projectLifecycleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Status inválido" };
  try {
    const { project, old } = await projectService.setLifecycleStatus(id, parsed.data.status, { organizationId, userId, allowedClientIds });
    await auditService.log({
      action: "UPDATE",
      entity: ENTITY,
      entityId: id,
      oldData: { name: old.name, status: old.status },
      newData: { name: project.name, status: project.status },
    });
    invalidate(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteProject(id: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "delete");
  try {
    const old = await projectService.softDelete(id, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "DELETE", entity: ENTITY, entityId: id, oldData: { code: old.code, name: old.name } });
    invalidate(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreProject(id: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "update");
  try {
    const project = await projectService.restore(id, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "RESTORE", entity: ENTITY, entityId: id, newData: { name: project.name } });
    invalidate(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteProjects(ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "delete");
  try {
    const result = await projectService.bulkSoftDelete(ids, { organizationId, userId, allowedClientIds });
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
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked(ENTITY, result.blocked, organizationId, userId);
    }
    invalidate();
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreProjects(ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "update");
  try {
    const count = await projectService.bulkRestore(ids, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "BULK_RESTORE", entity: ENTITY, entityId: ids.join(","), newData: { count } });
    invalidate();
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ── Risks ────────────────────────────────────────────────────────────────────

export async function saveProjectRisk(projectId: string, riskId: string | null, input: unknown) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "update");
  const parsed = projectRiskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const risk = await projectService.saveRisk(projectId, riskId, parsed.data, { organizationId, userId, allowedClientIds });
    await auditService.log({
      action: riskId ? "UPDATE" : "CREATE",
      entity: "ProjectRisk",
      entityId: risk.id,
      newData: { title: risk.title, status: risk.status },
      notify: false,
    });
    updateTag(`project-${projectId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteProjectRisk(projectId: string, riskId: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("projects", "update");
  try {
    const risk = await projectService.deleteRisk(projectId, riskId, { organizationId, userId, allowedClientIds });
    await auditService.log({ action: "DELETE", entity: "ProjectRisk", entityId: riskId, oldData: { title: risk.title }, notify: false });
    updateTag(`project-${projectId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
