import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDataserverInput, UpdateDataserverInput } from "@/schemas/dataserver.schema";
import type { Dataserver } from "@prisma/client";

class DataserverRepository extends BaseRepository<Dataserver> {
  constructor() {
    super(prisma.dataserver, ["code", "name"], "dataservers");
  }
}

export const dataserverRepository = new DataserverRepository();

export const dataserverService = {
  async list(params: Parameters<typeof dataserverRepository.findAll>[0], organizationId: string) {
    return dataserverRepository.findAll(params, organizationId);
  },

  async getById(id: string, organizationId: string) {
    return dataserverRepository.findById(id, organizationId);
  },

  async create(input: CreateDataserverInput, organizationId: string) {
    const existing = await prisma.dataserver.findFirst({ where: { code: input.code, organizationId } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return dataserverRepository.create({ ...input, organizationId } as any);
  },

  async update(id: string, input: UpdateDataserverInput, organizationId: string) {
    if (input.code) {
      const existing = await prisma.dataserver.findFirst({
        where: { code: input.code, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return dataserverRepository.update(id, input as any, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return dataserverRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return dataserverRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return dataserverRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return dataserverRepository.bulkRestore(ids, organizationId);
  },
};
