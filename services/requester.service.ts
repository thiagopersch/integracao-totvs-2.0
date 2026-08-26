import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateRequesterInput, UpdateRequesterInput } from "@/schemas/requester.schema";
import type { Requester } from "@prisma/client";

class RequesterRepository extends BaseRepository<Requester> {
  constructor() {
    super(prisma.requester, ["name", "email"], "requesters", "Requester");
  }
}

export const requesterRepository = new RequesterRepository();

export const requesterService = {
  async list(params: Parameters<typeof requesterRepository.findAll>[0], organizationId: string) {
    return requesterRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return requesterRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return requesterRepository.findById(id, organizationId);
  },

  async create(input: CreateRequesterInput, organizationId: string) {
    return requesterRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateRequesterInput, organizationId: string) {
    return requesterRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return requesterRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return requesterRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return requesterRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return requesterRepository.bulkRestore(ids, organizationId);
  },
};
