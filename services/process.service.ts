import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateProcessInput, UpdateProcessInput } from "@/schemas/process.schema";
import type { Process } from "@prisma/client";

class ProcessRepository extends BaseRepository<Process> {
  constructor() {
    super(prisma.process, ["code", "name"], "processes", "Process");
  }
}

export const processRepository = new ProcessRepository();

export const processService = {
  async list(params: Parameters<typeof processRepository.findAll>[0], organizationId: string) {
    return processRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return prisma.process.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  },

  async getById(id: string, organizationId: string) {
    return processRepository.findById(id, organizationId);
  },

  async create(input: CreateProcessInput, organizationId: string) {
    const existing = await prisma.process.findFirst({ where: { code: input.code, organizationId } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return processRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateProcessInput, organizationId: string) {
    if (input.code) {
      const existing = await prisma.process.findFirst({
        where: { code: input.code, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return processRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return processRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return processRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return processRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return processRepository.bulkRestore(ids, organizationId);
  },
};
