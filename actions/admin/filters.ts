"use server"

import { updateTag, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { filterService } from "@/services/filter.service";
import { backupService } from "@/services/backup.service";
import { auditService } from "@/services/audit.service";
import { tbcService } from "@/services/tbc.service";
import { restoreSentenceToTbc } from "@/services/rm-sentence.service";
import { createFilterSchema, updateFilterSchema } from "@/schemas/filter.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listFilters(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("filters");
  return filterService.list(params, organizationId);
}

export async function listDistinctSentenceCodes() {
  const { organizationId } = await getRequestContext();
  return filterService.listDistinctSentenceCodes(organizationId);
}

export async function getFilterById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`filter-${id}`);
  return filterService.getById(id, organizationId);
}

export async function getFilterByIdWithRelations(id: string, organizationId: string) {
  "use cache";
  cacheTag(`filter-${id}`);
  return filterService.getByIdWithRelations(id, organizationId);
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
    codColigadaSentenca: (formData.get("codColigadaSentenca") as string) || "",
    codSistemaSentenca: (formData.get("codSistemaSentenca") as string) || "",
    status: formData.get("status") === "true",
    schedule: (formData.get("schedule") as string) || "NONE",
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
    updateTag("filters");
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
    codColigadaSentenca: (formData.get("codColigadaSentenca") as string) || "",
    codSistemaSentenca: (formData.get("codSistemaSentenca") as string) || "",
    status: formData.get("status") === "true",
    schedule: (formData.get("schedule") as string) || "NONE",
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
    updateTag("filters");
    updateTag(`filter-${id}`);
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
    updateTag("filters");
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
    updateTag("filters");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setFilterStatus(id: string, status: boolean) {
  const { organizationId } = await requirePermission("filters", "update");
  try {
    await filterService.setStatus(id, status, organizationId);
    await auditService.log({ action: status ? "ACTIVATE" : "DEACTIVATE", entity: "Filter", entityId: id });
    updateTag("filters");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteFilters(ids: string[]) {
  const { organizationId, userId } = await requirePermission("filters", "delete");
  try {
    const result = await filterService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Filter",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Filter", result.blocked, organizationId, userId);
    }
    updateTag("filters");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createBackupFromFilter(filterId: string, sentenceCategoryId?: string) {
  "use server"
  const { organizationId, userId } = await requirePermission("backups", "create");
  try {
    await backupService.createFromFilter(filterId, organizationId, sentenceCategoryId, userId)
    await auditService.log({ action: "CREATE", entity: "BackupRun", entityId: filterId, organizationId, userId })
    updateTag("backups")
    updateTag("filters")
    updateTag(`filter-${filterId}`)
    updateTag(`filter-backups-${filterId}`)
    updateTag(`filter-backup-runs-${filterId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Pushes every active "sentença padrão" in a category to a chosen TBC — reuses
 * restoreSentenceToTbc (the same SaveRecord call the backup-restore flow uses) so the write path
 * to GConsSqlData is exercised in exactly one place.
 */
export async function importStandardSentencesToTbc(tbcId: string, sentenceCategoryId: string) {
  const { organizationId } = await requirePermission("filters", "update");
  try {
    const credentials = await tbcService.getCredentialsForRequest(tbcId, organizationId);
    const tbc = { ...credentials, id: tbcId };
    const sentences = await prisma.sentence.findMany({
      where: { sentenceCategoryId, organizationId, status: true, deletedAt: null },
    });

    if (sentences.length === 0) {
      return { success: false, error: "Nenhuma sentença padrão ativa encontrada nessa categoria" };
    }

    const failed: { code: string; error: string }[] = [];
    let imported = 0;

    for (const sentence of sentences) {
      if (!sentence.codSystem || !sentence.codColigada || !sentence.content) {
        failed.push({ code: sentence.code, error: "Coligada, sistema ou conteúdo não preenchidos" });
        continue;
      }
      try {
        await restoreSentenceToTbc(
          tbc,
          {
            codeSentence: sentence.code,
            codColigada: sentence.codColigada,
            codSystem: sentence.codSystem,
            nameSentence: sentence.name,
            contentSentence: sentence.content,
          },
          organizationId
        );
        imported++;
      } catch (error) {
        failed.push({ code: sentence.code, error: (error as Error).message });
      }
    }

    await auditService.log({
      action: "IMPORT_STANDARD_SENTENCES",
      entity: "Sentence",
      entityId: sentenceCategoryId,
      newData: { tbcId, imported, failed: failed.length },
    });

    return { success: true, imported, failed };
  } catch (error) {
    return { success: false, error: (error as Error).message };
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
    updateTag("filters");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
