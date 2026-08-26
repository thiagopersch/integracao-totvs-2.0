import { prisma } from "@/lib/prisma";
import type { CreateContractInput, UpdateContractInput } from "@/schemas/contract.schema";
import type { ListParams } from "@/types/common";
import type { BulkDeleteResult } from "@/repositories/base.repository";

const includeRelations = {
  client: { select: { id: true, name: true, color: true } },
} as const;

export const contractService = {
  async list(params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where: Record<string, unknown> = {
      client: {
        organizationId,
        ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      },
    };
    if (params.filters?.status) where.status = params.filters.status;

    const orderBy = params.sort ? { [params.sort.field]: params.sort.direction } : { createdAt: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.clientContract.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: includeRelations }),
      prisma.clientContract.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string) {
    return prisma.clientContract.findFirst({ where: { id, client: { organizationId } }, include: includeRelations });
  },

  async create(input: CreateContractInput, organizationId: string) {
    const client = await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null } });
    if (!client) throw new Error("Cliente não encontrado");

    const { startDate, endDate, ...rest } = input;
    return prisma.clientContract.create({
      data: { ...rest, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null },
      include: includeRelations,
    });
  },

  async update(id: string, input: UpdateContractInput, organizationId: string) {
    const existing = await prisma.clientContract.findFirst({ where: { id, client: { organizationId } } });
    if (!existing) throw new Error("Contrato não encontrado");

    const { startDate, endDate, ...rest } = input;
    return prisma.clientContract.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
      include: includeRelations,
    });
  },

  async delete(id: string, organizationId: string) {
    const existing = await prisma.clientContract.findFirst({ where: { id, client: { organizationId } } });
    if (!existing) throw new Error("Contrato não encontrado");
    return prisma.clientContract.delete({ where: { id } });
  },

  async bulkDelete(ids: string[], organizationId: string): Promise<BulkDeleteResult> {
    const owned = await prisma.clientContract.findMany({
      where: { id: { in: ids }, client: { organizationId } },
      select: { id: true },
    });
    const deletableIds = owned.map((c) => c.id);
    if (deletableIds.length > 0) {
      await prisma.clientContract.deleteMany({ where: { id: { in: deletableIds } } });
    }
    return { deletedCount: deletableIds.length, deletedIds: deletableIds, blocked: [] };
  },
};
