"use server"

import { updateTag, cacheTag } from "next/cache";
import { backupService } from "@/services/backup.service";
import { authService } from "@/services/auth.service";
import { auditService } from "@/services/audit.service";
import { createBackupSchema, updateBackupSchema } from "@/schemas/backup.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
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
    updateTag("backups");
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
    updateTag("backups");
    updateTag(`backup-${id}`);
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
    updateTag("backups");
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
    updateTag("backups");
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
    updateTag("backups");
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
    updateTag("backups");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listLatestBackupsForFilter(filterId: string, organizationId: string) {
  "use cache";
  cacheTag(`filter-backups-${filterId}`);
  return backupService.listLatestByFilter(filterId, organizationId);
}

export async function listBackupRunsForFilter(filterId: string, params: ListParams, organizationId: string) {
  "use cache";
  cacheTag(`filter-backup-runs-${filterId}`);
  return backupService.listRunsByFilter(filterId, params, organizationId);
}

export async function listBackupHistoryForCode(filterId: string, codeSentence: string) {
  const { organizationId } = await getRequestContext();
  return backupService.listHistoryByCode(filterId, codeSentence, organizationId);
}

export async function listBackupsForRun(backupRunId: string) {
  const { organizationId } = await getRequestContext();
  return backupService.listByRun(backupRunId, organizationId);
}

export async function verifyPasswordForRestore(password: string) {
  const { userId } = await requirePermission("backups", "restore");
  try {
    const valid = await authService.verifyPassword(userId, password);
    if (!valid) return { success: false, error: "Senha incorreta" };
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function invalidateBackupTags(filterId: string) {
  updateTag("backups");
  updateTag(`filter-backups-${filterId}`);
  updateTag(`filter-backup-runs-${filterId}`);
}

export async function restoreLatestBackupsForFilter(filterId: string, targetTbcId: string) {
  const { organizationId, userId } = await requirePermission("backups", "restore");
  try {
    const result = await backupService.restoreLatestForFilter(filterId, targetTbcId, organizationId, userId);
    await auditService.log({
      action: "RESTORE",
      entity: "Backup",
      entityId: filterId,
      newData: { scope: "filter-latest", targetTbcId, count: result.count },
    });
    invalidateBackupTags(filterId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreBackupsForRun(backupRunId: string, targetTbcId: string) {
  const { organizationId, userId } = await requirePermission("backups", "restore");
  try {
    const run = await prisma.backupRun.findFirst({ where: { id: backupRunId, organizationId } });
    if (!run) return { success: false, error: "Execução de backup não encontrada" };

    const result = await backupService.restoreForRun(backupRunId, targetTbcId, organizationId, userId);
    await auditService.log({
      action: "RESTORE",
      entity: "Backup",
      entityId: backupRunId,
      newData: { scope: "run", targetTbcId, count: result.count },
    });
    invalidateBackupTags(run.filterId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSingleBackup(backupId: string, targetTbcId: string) {
  const { organizationId, userId } = await requirePermission("backups", "restore");
  try {
    const backup = await prisma.backup.findFirst({ where: { id: backupId, organizationId } });
    if (!backup) return { success: false, error: "Backup não encontrado" };

    const result = await backupService.restoreSingle(backupId, targetTbcId, organizationId, userId);
    await auditService.log({
      action: "RESTORE",
      entity: "Backup",
      entityId: backupId,
      newData: { scope: "single", targetTbcId, count: result.count },
    });
    invalidateBackupTags(backup.filterId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
