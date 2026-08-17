import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateProcessInput, UpdateProcessInput } from "@/schemas/process.schema";
import type { Process } from "@prisma/client";

class ProcessRepository extends BaseRepository<Process> {
  constructor() {
    super(prisma.process, ["code", "name"]);
  }
}

export const processRepository = new ProcessRepository();

export const processService = {
  async list(params: Parameters<typeof processRepository.findAll>[0]) {
    return processRepository.findAll(params);
  },

  async getById(id: string) {
    return processRepository.findById(id);
  },

  async create(input: CreateProcessInput) {
    const existing = await prisma.process.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return processRepository.create(input as any);
  },

  async update(id: string, input: UpdateProcessInput) {
    if (input.code) {
      const existing = await prisma.process.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return processRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return processRepository.softDelete(id);
  },

  async restore(id: string) {
    return processRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return processRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return processRepository.bulkRestore(ids);
  },
};
