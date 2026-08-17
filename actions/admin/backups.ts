"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { backupService } from "@/services/backup.service";
import { auditService } from "@/services/audit.service";
import { createBackupSchema, updateBackupSchema } from "@/schemas/backup.schema";
import type { ListParams } from "@/types/common";

export async function listBackups(params: ListParams) {
  "use cache";
  cacheTag("backups");
  return backupService.list(params);
}

export async function getBackupById(id: string) {
  "use cache";
  cacheTag(`backup-${id}`);
  return backupService.getById(id);
}

export async function createBackup(formData: FormData) {
  const data = {
    tbcId: formData.get("tbcId") as string,
    filterId: formData.get("filterId") as string,
    branchSentence: formData.get("branchSentence") as string,
    codSystem: formData.get("codSystem") as string,
    codeSentence: formData.get("codeSentence") as string,
    nameSentence: formData.get("nameSentence") as string,
    contentSentence: formData.get("contentSentence") as string,
  };

  const parsed = createBackupSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await backupService.create(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "Backup",
      entityId: entity.id,
      newData: { codeSentence: entity.codeSentence, nameSentence: entity.nameSentence },
    });
    revalidateTag("backups", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateBackup(id: string, formData: FormData) {
  const data = {
    tbcId: formData.get("tbcId") as string,
    filterId: formData.get("filterId") as string,
    branchSentence: formData.get("branchSentence") as string,
    codSystem: formData.get("codSystem") as string,
    codeSentence: formData.get("codeSentence") as string,
    nameSentence: formData.get("nameSentence") as string,
    contentSentence: formData.get("contentSentence") as string,
  };

  const parsed = updateBackupSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await backupService.getById(id);
    const entity = await backupService.update(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "Backup",
      entityId: id,
      oldData: old ? { codeSentence: old.codeSentence, nameSentence: old.nameSentence } : undefined,
      newData: { codeSentence: entity.codeSentence, nameSentence: entity.nameSentence },
    });
    revalidateTag("backups", "max");
    revalidateTag(`backup-${id}`, "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteBackup(id: string) {
  try {
    const old = await backupService.getById(id);
    await backupService.softDelete(id);
    await auditService.log({
      action: "DELETE",
      entity: "Backup",
      entityId: id,
      oldData: old ? { codeSentence: old.codeSentence, nameSentence: old.nameSentence } : undefined,
    });
    revalidateTag("backups", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreBackup(id: string) {
  try {
    await backupService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Backup", entityId: id });
    revalidateTag("backups", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteBackups(ids: string[]) {
  try {
    const count = await backupService.bulkSoftDelete(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Backup",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("backups", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreBackups(ids: string[]) {
  try {
    const count = await backupService.bulkRestore(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Backup",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("backups", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
