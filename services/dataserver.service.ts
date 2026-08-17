import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDataserverInput, UpdateDataserverInput } from "@/schemas/dataserver.schema";
import type { Dataserver } from "@prisma/client";

class DataserverRepository extends BaseRepository<Dataserver> {
  constructor() {
    super(prisma.dataserver, ["code", "name"]);
  }
}

export const dataserverRepository = new DataserverRepository();

export const dataserverService = {
  async list(params: Parameters<typeof dataserverRepository.findAll>[0]) {
    return dataserverRepository.findAll(params);
  },

  async getById(id: string) {
    return dataserverRepository.findById(id);
  },

  async create(input: CreateDataserverInput) {
    const existing = await prisma.dataserver.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return dataserverRepository.create(input as any);
  },

  async update(id: string, input: UpdateDataserverInput) {
    if (input.code) {
      const existing = await prisma.dataserver.findFirst({
        where: { code: input.code, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return dataserverRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return dataserverRepository.softDelete(id);
  },

  async restore(id: string) {
    return dataserverRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return dataserverRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return dataserverRepository.bulkRestore(ids);
  },
};
