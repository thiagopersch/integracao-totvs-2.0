import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateClientInput, UpdateClientInput } from "@/schemas/client.schema";
import type { Client } from "@prisma/client";

class ClientRepository extends BaseRepository<Client> {
  constructor() {
    super(prisma.client, ["name", "linkCrm"]);
  }
}

export const clientRepository = new ClientRepository();

export const clientService = {
  async list(params: Parameters<typeof clientRepository.findAll>[0]) {
    return clientRepository.findAll(params);
  },

  async listAll() {
    return clientRepository.listAll();
  },

  async getById(id: string) {
    return clientRepository.findById(id);
  },

  async create(input: CreateClientInput) {
    const existing = await prisma.client.findUnique({ where: { linkCrm: input.linkCrm } });
    if (existing) {
      throw new Error("Link CRM já cadastrado");
    }
    return clientRepository.create(input as any);
  },

  async update(id: string, input: UpdateClientInput) {
    if (input.linkCrm) {
      const existing = await prisma.client.findFirst({
        where: { linkCrm: input.linkCrm, id: { not: id } },
      });
      if (existing) {
        throw new Error("Link CRM já cadastrado");
      }
    }
    return clientRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return clientRepository.softDelete(id);
  },

  async restore(id: string) {
    return clientRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return clientRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return clientRepository.bulkRestore(ids);
  },
};
