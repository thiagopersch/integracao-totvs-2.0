import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateSentenceInput, UpdateSentenceInput } from "@/schemas/sentence.schema";
import type { Sentence } from "@prisma/client";

class SentenceRepository extends BaseRepository<Sentence> {
  constructor() {
    super(prisma.sentence, ["code", "name"], "sentences", "Sentence");
  }
}

export const sentenceRepository = new SentenceRepository();

export const sentenceService = {
  async list(params: Parameters<typeof sentenceRepository.findAll>[0], organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await sentenceRepository.buildWhere(params, organizationId);
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

  async getById(id: string, organizationId: string) {
    return sentenceRepository.findById(id, organizationId);
  },

  async create(input: CreateSentenceInput, organizationId: string) {
    const existing = await prisma.sentence.findFirst({ where: { code: input.code, organizationId } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return sentenceRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateSentenceInput, organizationId: string) {
    if (input.code) {
      const existing = await prisma.sentence.findFirst({
        where: { code: input.code, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return sentenceRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return sentenceRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return sentenceRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return sentenceRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return sentenceRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return sentenceRepository.bulkRestore(ids, organizationId);
  },
};
