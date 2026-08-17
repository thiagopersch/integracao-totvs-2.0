import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateSentenceInput, UpdateSentenceInput } from "@/schemas/sentence.schema";
import type { Sentence } from "@prisma/client";

class SentenceRepository extends BaseRepository<Sentence> {
  constructor() {
    super(prisma.sentence, ["code", "name"]);
  }
}

export const sentenceRepository = new SentenceRepository();

export const sentenceService = {
  async list(params: Parameters<typeof sentenceRepository.findAll>[0]) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = sentenceRepository.buildWhere(params);
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : { createdAt: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.sentence.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.sentence.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string) {
    return sentenceRepository.findById(id);
  },

  async create(input: CreateSentenceInput) {
    const existing = await prisma.sentence.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return sentenceRepository.create(input as any);
  },

  async update(id: string, input: UpdateSentenceInput) {
    if (input.code) {
      const existing = await prisma.sentence.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return sentenceRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return sentenceRepository.softDelete(id);
  },

  async restore(id: string) {
    return sentenceRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return sentenceRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return sentenceRepository.bulkRestore(ids);
  },
};
