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
  async list(params: Parameters<typeof clientRepository.findAll>[0], organizationId: string, allowedClientIds: string[]) {
    return clientRepository.findAll(params, organizationId, { id: { in: allowedClientIds } });
  },

  async listAll(organizationId: string, allowedClientIds: string[]) {
    const allowedSet = new Set(allowedClientIds);
    const clients = await this.listAllUnrestricted(organizationId);
    return clients.filter((c) => allowedSet.has(c.id));
  },

  /**
   * Bypasses the caller's own client scope — only for the "assign clients to a user" picker,
   * gated by the "users:update" permission instead. A user restricted to 2 clients must still be
   * able to grant OTHER users access to any client in the org, not just their own.
   */
  async listAllUnrestricted(organizationId: string) {
    const clients = await clientRepository.listAll(organizationId);
    // DB collation ordering isn't guaranteed case-insensitive — sort here so "abc" and "ABC" interleave.
    return clients.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  },

  async listActiveWithTbc(organizationId: string, allowedClientIds: string[]) {
    return prisma.client.findMany({
      where: { deletedAt: null, status: true, organizationId, id: { in: allowedClientIds }, tbcs: { some: { deletedAt: null } } },
      orderBy: { name: "asc" },
    });
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]) {
    if (!allowedClientIds.includes(id)) return null;
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

  async update(id: string, input: UpdateClientInput, organizationId: string, allowedClientIds: string[]) {
    if (!allowedClientIds.includes(id)) throw new Error("Cliente não encontrado ou fora do seu escopo de acesso");
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

  async softDelete(id: string, organizationId: string, allowedClientIds: string[]) {
    if (!allowedClientIds.includes(id)) throw new Error("Cliente não encontrado ou fora do seu escopo de acesso");
    return clientRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string, allowedClientIds: string[]) {
    if (!allowedClientIds.includes(id)) throw new Error("Cliente não encontrado ou fora do seu escopo de acesso");
    return clientRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string, allowedClientIds: string[]) {
    if (!allowedClientIds.includes(id)) throw new Error("Cliente não encontrado ou fora do seu escopo de acesso");
    return clientRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string, allowedClientIds: string[]) {
    const allowedSet = new Set(allowedClientIds);
    return clientRepository.bulkSoftDelete(ids.filter((id) => allowedSet.has(id)), organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string, allowedClientIds: string[]) {
    const allowedSet = new Set(allowedClientIds);
    return clientRepository.bulkRestore(ids.filter((id) => allowedSet.has(id)), organizationId);
  },
};
