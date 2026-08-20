import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDemandInput, UpdateDemandInput } from "@/schemas/demand.schema";
import type { Demand } from "@prisma/client";
import type { ListParams } from "@/types/common";

class DemandRepository extends BaseRepository<Demand> {
  constructor() {
    super(prisma.demand, ["name", "description"], "demands");
  }
}

export const demandRepository = new DemandRepository();

const includeRelations = {
  analyst: { select: { id: true, name: true, color: true } },
  client: { select: { id: true, name: true, color: true } },
  requester: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  demandType: { select: { id: true, name: true, color: true } },
  demandTags: { include: { tag: true } },
} as const;

export const demandService = {
  async list(params: ListParams & { status?: boolean }, organizationId: string, analystScope?: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await demandRepository.buildWhere(params, organizationId);
    // Demand.status is a DemandStatus enum, not the boolean BaseRepository assumes for "status" filters.
    if (params.filters?.status) (where as Record<string, unknown>).status = params.filters.status;
    if (analystScope) (where as Record<string, unknown>).analystId = analystScope;
    const orderBy = params.sort ? { [params.sort.field]: params.sort.direction } : { date: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.demand.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: includeRelations }),
      prisma.demand.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string) {
    return prisma.demand.findFirst({ where: { id, organizationId, deletedAt: null }, include: includeRelations });
  },

  async create(input: CreateDemandInput, organizationId: string) {
    const { tagIds, date, ...rest } = input;
    return prisma.demand.create({
      data: {
        ...rest,
        date: new Date(date),
        organizationId,
        demandTags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: includeRelations,
    });
  },

  async update(id: string, input: UpdateDemandInput, organizationId: string) {
    const { tagIds, date, ...rest } = input;
    if (tagIds) {
      await prisma.demandTag.deleteMany({ where: { demandId: id } });
    }
    return prisma.demand.update({
      where: { id, organizationId },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        demandTags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: includeRelations,
    });
  },

  async softDelete(id: string, organizationId: string) {
    return demandRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return demandRepository.restore(id, organizationId);
  },
};
