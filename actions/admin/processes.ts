"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { processService } from "@/services/process.service";
import { auditService } from "@/services/audit.service";
import { createProcessSchema, updateProcessSchema } from "@/schemas/process.schema";
import type { ListParams } from "@/types/common";

export async function listProcesses(params: ListParams) {
  "use cache";
  cacheTag("processes");
  return processService.list(params);
}

export async function getProcessById(id: string) {
  "use cache";
  cacheTag(`process-${id}`);
  return processService.getById(id);
}

export async function createProcess(formData: FormData) {
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
    const entity = await processService.create(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "Process",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    revalidateTag("processes", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateProcess(id: string, formData: FormData) {
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
    const old = await processService.getById(id);
    const entity = await processService.update(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "Process",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    revalidateTag("processes", "max");
    revalidateTag(`process-${id}`, "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteProcess(id: string) {
  try {
    const old = await processService.getById(id);
    await processService.softDelete(id);
    await auditService.log({
      action: "DELETE",
      entity: "Process",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    revalidateTag("processes", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreProcess(id: string) {
  try {
    await processService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Process", entityId: id });
    revalidateTag("processes", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteProcesses(ids: string[]) {
  try {
    const count = await processService.bulkSoftDelete(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Process",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("processes", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreProcesses(ids: string[]) {
  try {
    const count = await processService.bulkRestore(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Process",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("processes", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
