import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateAnalystInput, UpdateAnalystInput } from "@/schemas/analyst.schema";
import type { Analyst } from "@prisma/client";

class AnalystRepository extends BaseRepository<Analyst> {
  constructor() {
    super(prisma.analyst, ["name", "email", "team"], "analysts");
  }
}

export const analystRepository = new AnalystRepository();

export const analystService = {
  async list(params: Parameters<typeof analystRepository.findAll>[0], organizationId: string) {
    return analystRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return analystRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return analystRepository.findById(id, organizationId);
  },

  async create(input: CreateAnalystInput, organizationId: string) {
    return analystRepository.create({ ...input, organizationId } as any);
  },

  async update(id: string, input: UpdateAnalystInput, organizationId: string) {
    return analystRepository.update(id, input as any, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return analystRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return analystRepository.restore(id, organizationId);
  },
};
