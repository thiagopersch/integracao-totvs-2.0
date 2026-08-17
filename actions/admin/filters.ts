"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { filterService } from "@/services/filter.service";
import { backupService } from "@/services/backup.service";
import { auditService } from "@/services/audit.service";
import { createFilterSchema, updateFilterSchema } from "@/schemas/filter.schema";
import type { ListParams } from "@/types/common";

export async function listFilters(params: ListParams) {
  "use cache";
  cacheTag("filters");
  return filterService.list(params);
}

export async function getFilterById(id: string) {
  "use cache";
  cacheTag(`filter-${id}`);
  return filterService.getById(id);
}

export async function createFilter(formData: FormData) {
  const data = {
    tbcId: formData.get("tbcId") as string,
    clientId: formData.get("clientId") as string,
    filter: formData.get("filter") as string,
    coligateContext: formData.get("coligateContext") as string,
    branchContext: formData.get("branchContext") as string,
    levelEducationContext: formData.get("levelEducationContext") as string,
    codSystemContext: formData.get("codSystemContext") as string,
    userContext: formData.get("userContext") as string,
    status: formData.get("status") === "true",
  };

  const parsed = createFilterSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await filterService.create(parsed.data);
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
  const data = {
    tbcId: formData.get("tbcId") as string,
    clientId: formData.get("clientId") as string,
    filter: formData.get("filter") as string,
    coligateContext: formData.get("coligateContext") as string,
    branchContext: formData.get("branchContext") as string,
    levelEducationContext: formData.get("levelEducationContext") as string,
    codSystemContext: formData.get("codSystemContext") as string,
    userContext: formData.get("userContext") as string,
    status: formData.get("status") === "true",
  };

  const parsed = updateFilterSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await filterService.getById(id);
    const entity = await filterService.update(id, parsed.data);
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
  try {
    const old = await filterService.getById(id);
    await filterService.softDelete(id);
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
  try {
    await filterService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Filter", entityId: id });
    revalidateTag("filters", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteFilters(ids: string[]) {
  try {
    const count = await filterService.bulkSoftDelete(ids);
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
  try {
    await backupService.createFromFilter(filterId)
    revalidateTag("backups", "max")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function bulkRestoreFilters(ids: string[]) {
  try {
    const count = await filterService.bulkRestore(ids);
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
