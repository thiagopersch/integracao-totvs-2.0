import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateSentenceCategoryInput, UpdateSentenceCategoryInput } from "@/schemas/sentence-category.schema";
import type { SentenceCategory } from "@prisma/client";

class SentenceCategoryRepository extends BaseRepository<SentenceCategory> {
  constructor() {
    super(prisma.sentenceCategory, ["code", "name"]);
  }
}

export const sentenceCategoryRepository = new SentenceCategoryRepository();

export const sentenceCategoryService = {
  async list(params: Parameters<typeof sentenceCategoryRepository.findAll>[0]) {
    return sentenceCategoryRepository.findAll(params);
  },

  async listAll() {
    return sentenceCategoryRepository.listAll();
  },

  async getById(id: string) {
    return sentenceCategoryRepository.findById(id);
  },

  async create(input: CreateSentenceCategoryInput) {
    const existing = await prisma.sentenceCategory.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return sentenceCategoryRepository.create(input as any);
  },

  async update(id: string, input: UpdateSentenceCategoryInput) {
    if (input.code) {
      const existing = await prisma.sentenceCategory.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return sentenceCategoryRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return sentenceCategoryRepository.softDelete(id);
  },

  async restore(id: string) {
    return sentenceCategoryRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return sentenceCategoryRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return sentenceCategoryRepository.bulkRestore(ids);
  },
};
