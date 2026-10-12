"use server"

import { updateTag, cacheTag } from "next/cache";
import { demandService } from "@/services/demand.service";
import { contractUsageService } from "@/services/contract-usage.service";
import { auditService } from "@/services/audit.service";
import { createDemandSchema, updateDemandSchema } from "@/schemas/demand.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { findLinkedAnalystId, getDemandAnalystScope } from "@/lib/demand-scope";
import { syncTaskLoggedMinutes } from "@/services/project-task.service";
import { listAllAnalysts } from "@/actions/analysts";
import { listAllClients } from "@/actions/admin/clients";
import { listAllRequesters } from "@/actions/requesters";
import { listAllDepartments } from "@/actions/departments";
import { listAllDemandTypes } from "@/actions/demand-types";
import { listAllTags } from "@/actions/tags";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { Period } from "@/lib/period";
import { periodToDateRange } from "@/lib/period";
export async function getDemandPeriodOptions() {
  const ctx = await getRequestContext();
  const analystScope = await getDemandAnalystScope(ctx);
  return getCachedDemandPeriodOptions(ctx.organizationId, ctx.allowedClientIds, analystScope);
}

async function getCachedDemandPeriodOptions(organizationId: string, allowedClientIds: string[], analystScope?: string) {
  "use cache";
  cacheTag("demands");
  return demandService.getAvailablePeriods(organizationId, allowedClientIds, analystScope);
}

export async function getDemandFilterOptions(period?: Period | null) {
  const ctx = await getRequestContext();
  const analystScope = await getDemandAnalystScope(ctx);
  return getCachedDemandFilterOptions(ctx.organizationId, ctx.allowedClientIds, analystScope, period ?? null);
}

async function getCachedDemandFilterOptions(
  organizationId: string,
  allowedClientIds: string[],
  analystScope: string | undefined,
  period: Period | null
) {
  "use cache";
  cacheTag("demands");
  return demandService.getFilterOptions(organizationId, allowedClientIds, analystScope, periodToDateRange(period));
}

/** Demand hours feed the contract consumption shown on /contracts and the dashboard. */
function invalidateDemandTags() {
  updateTag("demands");
  updateTag("contracts");
  updateTag("dashboard");
}

/**
 * Demands linked to projects are the projects' logged hours: re-sync the tasks' denormalized
 * hours and refresh the project screens (list hours/health, workspace, task sheet).
 */
async function syncProjectHours(links: { projectIds: (string | null | undefined)[]; taskIds: (string | null | undefined)[] }) {
  const projectIds = [...new Set(links.projectIds.filter((id): id is string => !!id))];
  const taskIds = [...new Set(links.taskIds.filter((id): id is string => !!id))];
  if (!projectIds.length && !taskIds.length) return;
  await syncTaskLoggedMinutes(taskIds);
  updateTag("projects");
  for (const id of projectIds) {
    updateTag(`project-${id}`);
    updateTag(`project-tasks-${id}`);
  }
  for (const id of taskIds) updateTag(`project-task-${id}`);
}

function parseDemandForm(formData: FormData) {
  return {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    date: formData.get("date") as string,
    startTime: formData.get("startTime") as string,
    endTime: formData.get("endTime") as string,
    priority: formData.get("priority") as string,
    status: formData.get("status") as string,
    notes: (formData.get("notes") as string) || undefined,
    analystId: formData.get("analystId") as string,
    clientId: formData.get("clientId") as string,
    requesterId: (formData.get("requesterId") as string) || undefined,
    departmentId: (formData.get("departmentId") as string) || undefined,
    demandTypeId: (formData.get("demandTypeId") as string) || undefined,
    tagIds: formData.getAll("tagIds") as string[],
    // Absent field = keep (update); "" = no project/task.
    projectId: formData.has("projectId") ? (formData.get("projectId") as string) : undefined,
    projectTaskId: formData.has("projectTaskId") ? (formData.get("projectTaskId") as string) : undefined,
  };
}

export async function createDemand(formData: FormData) {
  const ctx = await requirePermission("demands", "create");
  const parsed = createDemandSchema.safeParse(parseDemandForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  const scope = await getDemandAnalystScope(ctx);
  if (scope && parsed.data.analystId !== scope) {
    return { success: false, error: "Você só pode criar demandas para si mesmo" };
  }

  try {
    const entity = await demandService.create(parsed.data, ctx.organizationId, ctx.allowedClientIds);
    await auditService.log({ action: "CREATE", entity: "Demand", entityId: entity.id, newData: { name: entity.name } });
    await syncProjectHours({ projectIds: [entity.projectId], taskIds: [entity.projectTaskId] });
    // A new demand always re-sends the consumption email once the month is at 80%+.
    contractUsageService.scheduleCheck(ctx.organizationId, [{ clientId: entity.clientId, date: entity.date, trigger: "demand", demandId: entity.id }]);
    invalidateDemandTags();
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDemand(id: string, formData: FormData) {
  const ctx = await requirePermission("demands", "update");
  const parsed = updateDemandSchema.safeParse(parseDemandForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const before = await demandService.projectLinks([id], ctx.organizationId);
    const entity = await demandService.update(id, parsed.data, ctx.organizationId, ctx.allowedClientIds);
    await auditService.log({ action: "UPDATE", entity: "Demand", entityId: id, newData: { name: entity.name } });
    await syncProjectHours({
      projectIds: [...before.projectIds, entity.projectId],
      taskIds: [...before.taskIds, entity.projectTaskId],
    });
    contractUsageService.scheduleCheck(ctx.organizationId, [{ clientId: entity.clientId, date: entity.date, trigger: "contract", demandId: entity.id }]);
    invalidateDemandTags();
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function duplicateDemand(id: string) {
  const ctx = await requirePermission("demands", "create");
  const scope = await getDemandAnalystScope(ctx);

  try {
    const entity = await demandService.duplicate(id, ctx.organizationId, ctx.allowedClientIds, scope);
    await auditService.log({ action: "CREATE", entity: "Demand", entityId: entity.id, newData: { name: entity.name, duplicatedFrom: id } });
    await syncProjectHours({ projectIds: [entity.projectId], taskIds: [entity.projectTaskId] });
    // The copy adds hours to the contract just like a new demand.
    contractUsageService.scheduleCheck(ctx.organizationId, [{ clientId: entity.clientId, date: entity.date, trigger: "demand", demandId: entity.id }]);
    invalidateDemandTags();
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDemand(id: string) {
  const { organizationId, allowedClientIds } = await requirePermission("demands", "delete");
  try {
    const links = await demandService.projectLinks([id], organizationId);
    await demandService.softDelete(id, organizationId, allowedClientIds);
    await auditService.log({ action: "DELETE", entity: "Demand", entityId: id });
    await syncProjectHours(links);
    invalidateDemandTags();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteDemands(ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("demands", "delete");
  try {
    const links = await demandService.projectLinks(ids, organizationId);
    const result = await demandService.bulkSoftDelete(ids, organizationId, allowedClientIds);
    await syncProjectHours(links);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Demand",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Demand", result.blocked, organizationId, userId);
    }
    invalidateDemandTags();
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Data the demand form needs beyond its catalogs: projects the user can log hours on (with a client,
 * not finished) and the logged-in user's own analyst, used as the default "Analista" of a new demand.
 */
export async function getDemandFormContext() {
  const ctx = await requirePermission("demands", "create");
  const [projects, myAnalystId] = await Promise.all([
    demandService.listLinkableProjects(ctx.organizationId, ctx.allowedClientIds),
    findLinkedAnalystId(ctx.userId),
  ]);
  return { projects: projects.map((p) => ({ ...p, clientId: p.clientId! })), myAnalystId };
}

/**
 * Everything the shared demand form needs, loaded on demand (e.g. "Apontar horas" on a project,
 * where the page doesn't preload the demand catalogs).
 */
export async function getDemandFormData() {
  await requirePermission("demands", "create");
  const [analysts, clients, requesters, departments, demandTypes, tags, context] = await Promise.all([
    listAllAnalysts(),
    listAllClients(),
    listAllRequesters(),
    listAllDepartments(),
    listAllDemandTypes(),
    listAllTags(),
    getDemandFormContext(),
  ]);
  return { catalogs: { analysts, clients, requesters, departments, demandTypes, tags }, context };
}

/** Full demand for the shared edit form (opened from a project task's "Demandas" tab). */
export async function getDemandForEdit(id: string) {
  const ctx = await requirePermission("demands", "update");
  const scope = await getDemandAnalystScope(ctx);
  const demand = await demandService.getById(id, ctx.organizationId, ctx.allowedClientIds);
  if (!demand || (scope && demand.analystId !== scope)) return null;
  return demand;
}
