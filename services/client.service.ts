import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateClientInput, UpdateClientInput } from "@/schemas/client.schema";
import type { Client } from "@prisma/client";

class ClientRepository extends BaseRepository<Client> {
  constructor() {
    super(prisma.client, ["name", "legalName", "linkCrm", "document", "email"], "clients");
  }
}

export const clientRepository = new ClientRepository();

export const clientService = {
  async list(params: Parameters<typeof clientRepository.findAll>[0], organizationId: string) {
    return clientRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return clientRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return clientRepository.findById(id, organizationId);
  },

  async create(input: CreateClientInput, organizationId: string) {
    if (input.linkCrm) {
      const existing = await prisma.client.findFirst({ where: { linkCrm: input.linkCrm, organizationId } });
      if (existing) {
        throw new Error("Link CRM já cadastrado");
      }
    }
    return clientRepository.create({ ...input, organizationId } as any);
  },

  async update(id: string, input: UpdateClientInput, organizationId: string) {
    if (input.linkCrm) {
      const existing = await prisma.client.findFirst({
        where: { linkCrm: input.linkCrm, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Link CRM já cadastrado");
      }
    }
    return clientRepository.update(id, input as any, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return clientRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return clientRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return clientRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return clientRepository.bulkRestore(ids, organizationId);
  },
};
