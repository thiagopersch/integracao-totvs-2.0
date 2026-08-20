"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { filterService } from "@/services/filter.service";
import { backupService } from "@/services/backup.service";
import { auditService } from "@/services/audit.service";
import { createFilterSchema, updateFilterSchema } from "@/schemas/filter.schema";
import { requirePermission } from "@/lib/rbac";
import type { ListParams } from "@/types/common";

export async function listFilters(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("filters");
  return filterService.list(params, organizationId);
}

export async function getFilterById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`filter-${id}`);
  return filterService.getById(id, organizationId);
}

export async function createFilter(formData: FormData) {
  const { organizationId } = await requirePermission("filters", "create");
  const data = {
    tbcId: formData.get("tbcId") as string,
    clientId: formData.get("clientId") as string,
    filter: formData.get("filter") as string,
    coligateContext: formData.get("coligateContext") as string,
    branchContext: formData.get("branchContext") as string,
    levelEducationContext: formData.get("levelEducationContext") as string,
    codSystemContext: formData.get("codSystemContext") as string,
    userContext: formData.get("userContext") as string,
    codColigadaSentenca: (formData.get("codColigadaSentenca") as string) || undefined,
    codSistemaSentenca: (formData.get("codSistemaSentenca") as string) || undefined,
    status: formData.get("status") === "true",
  };

  const parsed = createFilterSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await filterService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "Filter",
      entityId: entity.id,
      newData: { filter: entity.filter, clientId: entity.clientId },
    });
    revalidateTag("filters", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFilter(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("filters", "update");
  const data = {
    tbcId: formData.get("tbcId") as string,
    clientId: formData.get("clientId") as string,
    filter: formData.get("filter") as string,
    coligateContext: formData.get("coligateContext") as string,
    branchContext: formData.get("branchContext") as string,
    levelEducationContext: formData.get("levelEducationContext") as string,
    codSystemContext: formData.get("codSystemContext") as string,
    userContext: formData.get("userContext") as string,
    codColigadaSentenca: (formData.get("codColigadaSentenca") as string) || undefined,
    codSistemaSentenca: (formData.get("codSistemaSentenca") as string) || undefined,
    status: formData.get("status") === "true",
  };

  const parsed = updateFilterSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await filterService.getById(id, organizationId);
    const entity = await filterService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "Filter",
      entityId: id,
      oldData: old ? { filter: old.filter, clientId: old.clientId } : undefined,
      newData: { filter: entity.filter, clientId: entity.clientId },
    });
    revalidateTag("filters", "max");
    revalidateTag(`filter-${id}`, "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteFilter(id: string) {
  const { organizationId } = await requirePermission("filters", "delete");
  try {
    const old = await filterService.getById(id, organizationId);
    await filterService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "Filter",
      entityId: id,
      oldData: old ? { filter: old.filter, clientId: old.clientId } : undefined,
    });
    revalidateTag("filters", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreFilter(id: string) {
  const { organizationId } = await requirePermission("filters", "update");
  try {
    await filterService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Filter", entityId: id });
    revalidateTag("filters", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteFilters(ids: string[]) {
  const { organizationId } = await requirePermission("filters", "delete");
  try {
    const count = await filterService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Filter",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("filters", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createBackupFromFilter(filterId: string) {
  "use server"
  const { organizationId } = await requirePermission("backups", "create");
  try {
    await backupService.createFromFilter(filterId, organizationId)
    revalidateTag("backups", "max")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function bulkRestoreFilters(ids: string[]) {
  const { organizationId } = await requirePermission("filters", "update");
  try {
    const count = await filterService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Filter",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("filters", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
