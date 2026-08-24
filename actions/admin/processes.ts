"use server"

import { updateTag, cacheTag } from "next/cache";
import { processService } from "@/services/process.service";
import { auditService } from "@/services/audit.service";
import { createProcessSchema, updateProcessSchema } from "@/schemas/process.schema";
import { requirePermission } from "@/lib/rbac";
import type { ListParams } from "@/types/common";

export async function listProcesses(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("processes");
  return processService.list(params, organizationId);
}

export async function getProcessById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`process-${id}`);
  return processService.getById(id, organizationId);
}

export async function createProcess(formData: FormData) {
  const { organizationId } = await requirePermission("processes", "create");
  const data = {
    code: formData.get("code") as string,
    nameAlternative: formData.get("nameAlternative") as string,
    name: formData.get("name") as string,
  };

  const parsed = createProcessSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await processService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "Process",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("processes");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateProcess(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("processes", "update");
  const data = {
    code: formData.get("code") as string,
    nameAlternative: formData.get("nameAlternative") as string,
    name: formData.get("name") as string,
  };

  const parsed = updateProcessSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await processService.getById(id, organizationId);
    const entity = await processService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "Process",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("processes");
    updateTag(`process-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteProcess(id: string) {
  const { organizationId } = await requirePermission("processes", "delete");
  try {
    const old = await processService.getById(id, organizationId);
    await processService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "Process",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    updateTag("processes");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreProcess(id: string) {
  const { organizationId } = await requirePermission("processes", "update");
  try {
    await processService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Process", entityId: id });
    updateTag("processes");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteProcesses(ids: string[]) {
  const { organizationId } = await requirePermission("processes", "delete");
  try {
    const count = await processService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Process",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("processes");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreProcesses(ids: string[]) {
  const { organizationId } = await requirePermission("processes", "update");
  try {
    const count = await processService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Process",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("processes");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
