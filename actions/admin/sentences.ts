"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { sentenceService } from "@/services/sentence.service";
import { auditService } from "@/services/audit.service";
import { createSentenceSchema, updateSentenceSchema } from "@/schemas/sentence.schema";
import type { ListParams } from "@/types/common";

export async function listSentences(params: ListParams) {
  "use cache";
  cacheTag("sentences");
  return sentenceService.list(params);
}

export async function getSentenceById(id: string) {
  "use cache";
  cacheTag(`sentence-${id}`);
  return sentenceService.getById(id);
}

export async function createSentence(formData: FormData) {
  const data = {
    sentenceCategoryId: formData.get("sentenceCategoryId") as string,
    code: formData.get("code") as string,
    codSystem: formData.get("codSystem") as string,
    name: formData.get("name") as string,
    content: formData.get("content") as string,
    status: formData.get("status") === "true",
  };

  const parsed = createSentenceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await sentenceService.create(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "Sentence",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    revalidateTag("sentences", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSentence(id: string, formData: FormData) {
  const data = {
    sentenceCategoryId: formData.get("sentenceCategoryId") as string,
    code: formData.get("code") as string,
    codSystem: formData.get("codSystem") as string,
    name: formData.get("name") as string,
    content: formData.get("content") as string,
    status: formData.get("status") === "true",
  };

  const parsed = updateSentenceSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await sentenceService.getById(id);
    const entity = await sentenceService.update(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "Sentence",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    revalidateTag("sentences", "max");
    revalidateTag(`sentence-${id}`, "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSentence(id: string) {
  try {
    const old = await sentenceService.getById(id);
    await sentenceService.softDelete(id);
    await auditService.log({
      action: "DELETE",
      entity: "Sentence",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    revalidateTag("sentences", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSentence(id: string) {
  try {
    await sentenceService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Sentence", entityId: id });
    revalidateTag("sentences", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteSentences(ids: string[]) {
  try {
    const count = await sentenceService.bulkSoftDelete(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Sentence",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("sentences", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreSentences(ids: string[]) {
  try {
    const count = await sentenceService.bulkRestore(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Sentence",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("sentences", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
