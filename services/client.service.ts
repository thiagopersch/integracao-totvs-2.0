import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateClientInput, UpdateClientInput } from "@/schemas/client.schema";
import type { Client } from "@prisma/client";
import type { ListParams } from "@/types/common";

class ClientRepository extends BaseRepository<Client> {
  constructor() {
    super(prisma.client, ["name", "legalName", "linkCrm", "document", "email"], "clients", "Client");
  }

  async buildWhere(input: ListParams & { status?: boolean }, organizationId?: string) {
    const { hasImage, ...restFilters } = input.filters ?? {};
    const where = await super.buildWhere({ ...input, filters: restFilters }, organizationId);
    if (hasImage === "true") where.image = { not: null };
    else if (hasImage === "false") where.image = null;
    return where;
  }

  protected defaultOrderBy() {
    return [{ favorite: "desc" as const }, { name: "asc" as const }];
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

  async listActiveWithTbc(organizationId: string) {
    return prisma.client.findMany({
      where: { deletedAt: null, status: true, organizationId, tbcs: { some: { deletedAt: null } } },
      orderBy: { name: "asc" },
    });
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
    return clientRepository.create({ ...input, organizationId });
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
    return clientRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return clientRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return clientRepository.setStatus(id, status, organizationId);
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
