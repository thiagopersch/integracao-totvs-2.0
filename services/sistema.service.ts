import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateSistemaInput, UpdateSistemaInput } from "@/schemas/sistema.schema";
import type { TotvsSystem } from "@prisma/client";

class SistemaRepository extends BaseRepository<TotvsSystem> {
  constructor() {
    super(prisma.totvsSystem, ["code", "internalName", "externalName"], "totvs_systems");
  }

  async listAll(organizationId: string): Promise<TotvsSystem[]> {
    return this.model.findMany({
      where: { deletedAt: null, organizationId },
      orderBy: { code: "asc" as const },
    }) as Promise<TotvsSystem[]>;
  }
}

export const sistemaRepository = new SistemaRepository();

export const sistemaService = {
  async list(params: Parameters<typeof sistemaRepository.findAll>[0], organizationId: string) {
    return sistemaRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return sistemaRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return sistemaRepository.findById(id, organizationId);
  },

  async create(input: CreateSistemaInput, organizationId: string) {
    const existing = await prisma.totvsSystem.findFirst({ where: { code: input.code, organizationId } });
    if (existing) {
      throw new Error("Código já cadastrado");
    }
    return sistemaRepository.create({ ...input, organizationId } as any);
  },

  async update(id: string, input: UpdateSistemaInput, organizationId: string) {
    if (input.code) {
      const existing = await prisma.totvsSystem.findFirst({
        where: { code: input.code, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Código já cadastrado");
      }
    }
    return sistemaRepository.update(id, input as any, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return sistemaRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return sistemaRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return sistemaRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return sistemaRepository.bulkRestore(ids, organizationId);
  },
};
