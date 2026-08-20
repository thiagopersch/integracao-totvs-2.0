import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDemandTypeInput, UpdateDemandTypeInput } from "@/schemas/demand-type.schema";
import type { DemandType } from "@prisma/client";

class DemandTypeRepository extends BaseRepository<DemandType> {
  constructor() {
    super(prisma.demandType, ["name", "description"], "demand_types");
  }
}

export const demandTypeRepository = new DemandTypeRepository();

export const demandTypeService = {
  async list(params: Parameters<typeof demandTypeRepository.findAll>[0], organizationId: string) {
    return demandTypeRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return demandTypeRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return demandTypeRepository.findById(id, organizationId);
  },

  async create(input: CreateDemandTypeInput, organizationId: string) {
    return demandTypeRepository.create({ ...input, organizationId } as any);
  },

  async update(id: string, input: UpdateDemandTypeInput, organizationId: string) {
    return demandTypeRepository.update(id, input as any, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return demandTypeRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return demandTypeRepository.restore(id, organizationId);
  },
};
