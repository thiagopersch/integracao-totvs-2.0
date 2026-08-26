"use server"

import { updateTag, cacheTag } from "next/cache";
import { sentenceService } from "@/services/sentence.service";
import { auditService } from "@/services/audit.service";
import { createSentenceSchema, updateSentenceSchema } from "@/schemas/sentence.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listSentences(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("sentences");
  return sentenceService.list(params, organizationId);
}

export async function getSentenceById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`sentence-${id}`);
  return sentenceService.getById(id, organizationId);
}

export async function createSentence(formData: FormData) {
  const { organizationId } = await requirePermission("sentences", "create");
  const data = {
    sentenceCategoryId: formData.get("sentenceCategoryId") as string,
    code: formData.get("code") as string,
    codSystem: formData.get("codSystem") as string,
    codColigada: formData.get("codColigada") as string,
    name: formData.get("name") as string,
    content: formData.get("content") as string,
    status: formData.get("status") === "true",
  };

  const parsed = createSentenceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await sentenceService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "Sentence",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("sentences");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSentence(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("sentences", "update");
  const data = {
    sentenceCategoryId: formData.get("sentenceCategoryId") as string,
    code: formData.get("code") as string,
    codSystem: formData.get("codSystem") as string,
    codColigada: formData.get("codColigada") as string,
    name: formData.get("name") as string,
    content: formData.get("content") as string,
    status: formData.get("status") === "true",
  };

  const parsed = updateSentenceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await sentenceService.getById(id, organizationId);
    const entity = await sentenceService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "Sentence",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("sentences");
    updateTag(`sentence-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSentence(id: string) {
  const { organizationId } = await requirePermission("sentences", "delete");
  try {
    const old = await sentenceService.getById(id, organizationId);
    await sentenceService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "Sentence",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    updateTag("sentences");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSentence(id: string) {
  const { organizationId } = await requirePermission("sentences", "update");
  try {
    await sentenceService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Sentence", entityId: id });
    updateTag("sentences");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setSentenceStatus(id: string, status: boolean) {
  const { organizationId } = await requirePermission("sentences", "update");
  try {
    await sentenceService.setStatus(id, status, organizationId);
    await auditService.log({ action: status ? "ACTIVATE" : "DEACTIVATE", entity: "Sentence", entityId: id });
    updateTag("sentences");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteSentences(ids: string[]) {
  const { organizationId, userId } = await requirePermission("sentences", "delete");
  try {
    const result = await sentenceService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Sentence",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Sentence", result.blocked, organizationId, userId);
    }
    updateTag("sentences");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreSentences(ids: string[]) {
  const { organizationId } = await requirePermission("sentences", "update");
  try {
    const count = await sentenceService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Sentence",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("sentences");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
