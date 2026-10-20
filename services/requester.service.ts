import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateRequesterInput, UpdateRequesterInput } from "@/schemas/requester.schema";
import type { Prisma, Requester } from "@/generated/prisma/client";
import type { BlockingReference } from "@/lib/entity-labels";
import { ENTITY_LABELS } from "@/lib/entity-labels";
import type { SortParams } from "@/types/common";

const listInclude = {
  client: { select: { id: true, name: true, color: true } },
} satisfies Prisma.RequesterInclude;

export type RequesterWithClient = Prisma.RequesterGetPayload<{ include: typeof listInclude }>;

/** Requester as used by the demand form cascade: its client and the departments it belongs to. */
export type RequesterOption = Requester & { departmentIds: string[] };

class RequesterRepository extends BaseRepository<Requester> {
  constructor() {
    super(prisma.requester, ["name", "email"], "requesters", "Requester");
  }

  protected override orderByFor(sort: SortParams) {
    if (sort.field === "client") return { client: { name: sort.direction } };
    return super.orderByFor(sort);
  }

  protected override listInclude() {
    return listInclude;
  }

  // Department links are checked below so a soft-deleted department doesn't keep blocking.
  protected override ownedModels() {
    return ["DepartmentRequester"];
  }

  protected override async extraBlockingReferences(id: string): Promise<BlockingReference[]> {
    const count = await prisma.departmentRequester.count({ where: { requesterId: id, department: { deletedAt: null } } });
    return count > 0
      ? [{ model: "DepartmentRequester", label: ENTITY_LABELS.DepartmentRequester, field: "requesterId", count }]
      : [];
  }
}

export const requesterRepository = new RequesterRepository();

async function assertClientInOrganization(clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId, deletedAt: null }, select: { id: true } });
  if (!client) throw new Error("Cliente não encontrado");
}

export const requesterService = {
  async list(params: Parameters<typeof requesterRepository.findAll>[0], organizationId: string) {
    return requesterRepository.findAll(params, organizationId) as Promise<{
      data: RequesterWithClient[];
      meta: Awaited<ReturnType<typeof requesterRepository.findAll>>["meta"];
    }>;
  },

  async listAll(organizationId: string): Promise<RequesterOption[]> {
    const rows = await prisma.requester.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { departmentRequesters: { select: { departmentId: true } } },
    });
    return rows.map(({ departmentRequesters, ...r }) => ({ ...r, departmentIds: departmentRequesters.map((d) => d.departmentId) }));
  },

  async getById(id: string, organizationId: string) {
    return requesterRepository.findById(id, organizationId);
  },

  async create(input: CreateRequesterInput, organizationId: string) {
    await assertClientInOrganization(input.clientId, organizationId);
    return requesterRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateRequesterInput, organizationId: string) {
    await assertClientInOrganization(input.clientId, organizationId);
    const current = await requesterRepository.findById(id, organizationId);
    if (!current) throw new Error("Solicitante não encontrado");
    return prisma.$transaction(async (tx) => {
      // Moving to another client: drop department links that belong to the previous one.
      if (current.clientId !== input.clientId) {
        await tx.departmentRequester.deleteMany({ where: { requesterId: id, department: { clientId: { not: input.clientId } } } });
      }
      return tx.requester.update({ where: { id, organizationId }, data: input });
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
