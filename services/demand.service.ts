import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import { assertClientAllowed } from "@/lib/client-access";
import { timeToMinutes, type CreateDemandInput, type UpdateDemandInput } from "@/schemas/demand.schema";
import type { Demand } from "@/generated/prisma/client";
import type { ListParams } from "@/types/common";

function combineDateAndTime(dateStr: string, time: string): Date {
  const date = new Date(dateStr);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0));
}

class DemandRepository extends BaseRepository<Demand> {
  constructor() {
    super(prisma.demand, ["name", "description"], "demands", "Demand");
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
  async list(params: ListParams & { status?: boolean }, organizationId: string, allowedClientIds: string[], analystScope?: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await demandRepository.buildWhere(params, organizationId);
    // Demand.status is a DemandStatus enum, not the boolean BaseRepository assumes for "status" filters.
    if (params.filters?.status) (where as Record<string, unknown>).status = params.filters.status;
    if (analystScope) (where as Record<string, unknown>).analystId = analystScope;
    (where as Record<string, unknown>).clientId = { in: allowedClientIds };
    const orderBy = params.sort ? { [params.sort.field]: params.sort.direction } : { date: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.demand.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: includeRelations }),
      prisma.demand.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]) {
    return prisma.demand.findFirst({
      where: { id, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
      include: includeRelations,
    });
  },

  async create(input: CreateDemandInput, organizationId: string, allowedClientIds: string[]) {
    assertClientAllowed(input.clientId, allowedClientIds);
    const { tagIds, date, startTime, endTime, ...rest } = input;
    return prisma.demand.create({
      data: {
        ...rest,
        date: new Date(date),
        startTime: combineDateAndTime(date, startTime),
        endTime: combineDateAndTime(date, endTime),
        durationMinutes: timeToMinutes(endTime) - timeToMinutes(startTime),
        organizationId,
        demandTags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: includeRelations,
    });
  },

  async update(id: string, input: UpdateDemandInput, organizationId: string, allowedClientIds: string[]) {
    if (input.clientId) assertClientAllowed(input.clientId, allowedClientIds);
    const existing = await prisma.demand.findFirst({ where: { id, organizationId, clientId: { in: allowedClientIds } } });
    if (!existing) throw new Error("Demanda não encontrada ou fora do seu escopo de acesso");

    const { tagIds, date, startTime, endTime, ...rest } = input;
    if (tagIds) {
      await prisma.demandTag.deleteMany({ where: { demandId: id } });
    }
    const effectiveDate = date ?? existing.date.toISOString();

    return prisma.demand.update({
      where: { id, organizationId },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...(startTime && effectiveDate ? { startTime: combineDateAndTime(effectiveDate, startTime) } : {}),
        ...(endTime && effectiveDate ? { endTime: combineDateAndTime(effectiveDate, endTime) } : {}),
        ...(startTime && endTime ? { durationMinutes: timeToMinutes(endTime) - timeToMinutes(startTime) } : {}),
        demandTags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: includeRelations,
    });
  },

  async softDelete(id: string, organizationId: string, allowedClientIds: string[]) {
    return demandRepository.softDelete(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  async restore(id: string, organizationId: string, allowedClientIds: string[]) {
    return demandRepository.restore(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  async bulkSoftDelete(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return demandRepository.bulkSoftDelete(ids, organizationId, { clientId: { in: allowedClientIds } });
  },

  async bulkRestore(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return demandRepository.bulkRestore(ids, organizationId, { clientId: { in: allowedClientIds } });
  },
};
