import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateRequesterInput, UpdateRequesterInput } from "@/schemas/requester.schema";
import type { Prisma, Requester } from "@/generated/prisma/client";
import type { BlockingReference } from "@/lib/entity-labels";
import { ENTITY_LABELS } from "@/lib/entity-labels";

const listInclude = {
  requesterClients: { select: { client: { select: { id: true, name: true, color: true } } }, orderBy: { client: { name: "asc" } } },
} satisfies Prisma.RequesterInclude;

export type RequesterWithClients = Prisma.RequesterGetPayload<{ include: typeof listInclude }>;

/** Requester as used by the demand form cascade: its clients and the departments it belongs to. */
export type RequesterOption = Requester & { clientIds: string[]; departmentIds: string[] };

class RequesterRepository extends BaseRepository<Requester> {
  constructor() {
    super(prisma.requester, ["name", "email"], "requesters", "Requester");
  }

  protected override defaultOrderBy() {
    return { name: "asc" as const };
  }

  protected override listInclude() {
    return listInclude;
  }

  // Client links are part of the requester itself; department links are checked below so a
  // soft-deleted department doesn't keep blocking.
  protected override ownedModels() {
    return ["RequesterClient", "DepartmentRequester"];
  }

  protected override async extraBlockingReferences(id: string): Promise<BlockingReference[]> {
    const count = await prisma.departmentRequester.count({ where: { requesterId: id, department: { deletedAt: null } } });
    return count > 0
      ? [{ model: "DepartmentRequester", label: ENTITY_LABELS.DepartmentRequester, field: "requesterId", count }]
      : [];
  }
}

export const requesterRepository = new RequesterRepository();

/** Every client must be in the organization; returns the de-duplicated ids. */
async function assertClientsInOrganization(ids: string[], organizationId: string) {
  const clientIds = [...new Set(ids)];
  const count = await prisma.client.count({ where: { id: { in: clientIds }, organizationId, deletedAt: null } });
  if (count !== clientIds.length) throw new Error("Cliente não encontrado");
  return clientIds;
}

export const requesterService = {
  async list(params: Parameters<typeof requesterRepository.findAll>[0], organizationId: string) {
    return requesterRepository.findAll(params, organizationId) as Promise<{
      data: RequesterWithClients[];
      meta: Awaited<ReturnType<typeof requesterRepository.findAll>>["meta"];
    }>;
  },

  async listAll(organizationId: string): Promise<RequesterOption[]> {
    const rows = await prisma.requester.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { requesterClients: { select: { clientId: true } }, departmentRequesters: { select: { departmentId: true } } },
    });
    return rows.map(({ requesterClients, departmentRequesters, ...r }) => ({
      ...r,
      clientIds: requesterClients.map((c) => c.clientId),
      departmentIds: departmentRequesters.map((d) => d.departmentId),
    }));
  },

  async getById(id: string, organizationId: string) {
    return requesterRepository.findById(id, organizationId);
  },

  async create(input: CreateRequesterInput, organizationId: string) {
    const { clientIds: ids, ...data } = input;
    const clientIds = await assertClientsInOrganization(ids, organizationId);
    return prisma.requester.create({
      data: { ...data, organizationId, requesterClients: { create: clientIds.map((clientId) => ({ clientId })) } },
    });
  },

  async update(id: string, input: UpdateRequesterInput, organizationId: string) {
    const { clientIds: ids, ...data } = input;
    const clientIds = await assertClientsInOrganization(ids, organizationId);
    const current = await requesterRepository.findById(id, organizationId);
    if (!current) throw new Error("Solicitante não encontrado");
    return prisma.$transaction(async (tx) => {
      // A removed client: drop links to departments that apply to none of the remaining ones.
      await tx.departmentRequester.deleteMany({
        where: { requesterId: id, department: { departmentClients: { none: { clientId: { in: clientIds } } } } },
      });
      return tx.requester.update({
        where: { id, organizationId },
        data: { ...data, requesterClients: { deleteMany: {}, create: clientIds.map((clientId) => ({ clientId })) } },
      });
    });
  },

  async softDelete(id: string, organizationId: string) {
    return requesterRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return requesterRepository.setStatus(id, status, organizationId);
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
