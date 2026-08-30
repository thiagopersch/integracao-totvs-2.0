import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateSentenceCategoryInput, UpdateSentenceCategoryInput } from "@/schemas/sentence-category.schema";
import type { SentenceCategory } from "@/generated/prisma/client";

class SentenceCategoryRepository extends BaseRepository<SentenceCategory> {
  constructor() {
    super(prisma.sentenceCategory, ["code", "name"], "sentence_categories", "SentenceCategory");
  }
}

export const sentenceCategoryRepository = new SentenceCategoryRepository();

export const sentenceCategoryService = {
  async list(params: Parameters<typeof sentenceCategoryRepository.findAll>[0], organizationId: string) {
    return sentenceCategoryRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return sentenceCategoryRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return sentenceCategoryRepository.findById(id, organizationId);
  },

  async create(input: CreateSentenceCategoryInput, organizationId: string) {
    const existing = await prisma.sentenceCategory.findFirst({ where: { code: input.code, organizationId } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return sentenceCategoryRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateSentenceCategoryInput, organizationId: string) {
    if (input.code) {
      const existing = await prisma.sentenceCategory.findFirst({
        where: { code: input.code, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return sentenceCategoryRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return sentenceCategoryRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return sentenceCategoryRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return sentenceCategoryRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return sentenceCategoryRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return sentenceCategoryRepository.bulkRestore(ids, organizationId);
  },
};
