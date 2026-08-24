"use server"

import { updateTag, cacheTag } from "next/cache";
import { sentenceCategoryService } from "@/services/sentence-category.service";
import { auditService } from "@/services/audit.service";
import { createSentenceCategorySchema, updateSentenceCategorySchema } from "@/schemas/sentence-category.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import type { ListParams } from "@/types/common";

export async function listAllSentenceCategories() {
  const { organizationId } = await getRequestContext();
  return sentenceCategoryService.listAll(organizationId);
}

export async function listSentenceCategories(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("sentenceCategories");
  return sentenceCategoryService.list(params, organizationId);
}

export async function getSentenceCategoryById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`sentenceCategory-${id}`);
  return sentenceCategoryService.getById(id, organizationId);
}

export async function createSentenceCategory(formData: FormData) {
  const { organizationId } = await requirePermission("sentence_categories", "create");
  const data = {
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    status: formData.get("status") === "true",
  };

  const parsed = createSentenceCategorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await sentenceCategoryService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "SentenceCategory",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("sentenceCategories");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSentenceCategory(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("sentence_categories", "update");
  const data = {
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    status: formData.get("status") === "true",
  };

  const parsed = updateSentenceCategorySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await sentenceCategoryService.getById(id, organizationId);
    const entity = await sentenceCategoryService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "SentenceCategory",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("sentenceCategories");
    updateTag(`sentenceCategory-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSentenceCategory(id: string) {
  const { organizationId } = await requirePermission("sentence_categories", "delete");
  try {
    const old = await sentenceCategoryService.getById(id, organizationId);
    await sentenceCategoryService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "SentenceCategory",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    updateTag("sentenceCategories");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSentenceCategory(id: string) {
  const { organizationId } = await requirePermission("sentence_categories", "update");
  try {
    await sentenceCategoryService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "SentenceCategory", entityId: id });
    updateTag("sentenceCategories");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteSentenceCategories(ids: string[]) {
  const { organizationId } = await requirePermission("sentence_categories", "delete");
  try {
    const count = await sentenceCategoryService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "SentenceCategory",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("sentenceCategories");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreSentenceCategories(ids: string[]) {
  const { organizationId } = await requirePermission("sentence_categories", "update");
  try {
    const count = await sentenceCategoryService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "SentenceCategory",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("sentenceCategories");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
