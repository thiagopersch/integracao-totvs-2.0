"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { backupService } from "@/services/backup.service";
import { auditService } from "@/services/audit.service";
import { createBackupSchema, updateBackupSchema } from "@/schemas/backup.schema";
import { requirePermission } from "@/lib/rbac";
import type { ListParams } from "@/types/common";

export async function listBackups(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("backups");
  return backupService.list(params, organizationId);
}

export async function getBackupById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`backup-${id}`);
  return backupService.getById(id, organizationId);
}

export async function createBackup(formData: FormData) {
  const { organizationId } = await requirePermission("backups", "create");
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
    const entity = await backupService.create(parsed.data, organizationId);
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
  const { organizationId } = await requirePermission("backups", "update");
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
    const old = await backupService.getById(id, organizationId);
    const entity = await backupService.update(id, parsed.data, organizationId);
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
  const { organizationId } = await requirePermission("backups", "delete");
  try {
    const old = await backupService.getById(id, organizationId);
    await backupService.softDelete(id, organizationId);
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
  const { organizationId } = await requirePermission("backups", "update");
  try {
    await backupService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Backup", entityId: id });
    revalidateTag("backups", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteBackups(ids: string[]) {
  const { organizationId } = await requirePermission("backups", "delete");
  try {
    const count = await backupService.bulkSoftDelete(ids, organizationId);
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
  const { organizationId } = await requirePermission("backups", "update");
  try {
    const count = await backupService.bulkRestore(ids, organizationId);
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
