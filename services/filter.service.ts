import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import { computeNextRunAt } from "@/lib/backup-schedule";
import type { CreateFilterInput, UpdateFilterInput } from "@/schemas/filter.schema";
import type { ListParams } from "@/types/common";
import type { Filter } from "@prisma/client";

class FilterRepository extends BaseRepository<Filter> {
  constructor() {
    super(prisma.filter, ["filter", "codSystemContext", "userContext"], "filters", "Filter");
  }

  async buildWhere(input: ListParams & { status?: boolean }, organizationId?: string) {
    const { notRequiredLicense, ...restFilters } = input.filters ?? {};
    const where = await super.buildWhere({ ...input, filters: restFilters }, organizationId);
    if (notRequiredLicense === "true") where.tbc = { notRequiredLicense: true };
    else if (notRequiredLicense === "false") where.tbc = { notRequiredLicense: false };
    return where;
  }
}

export const filterRepository = new FilterRepository();

export const filterService = {
  async list(params: Parameters<typeof filterRepository.findAll>[0], organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await filterRepository.buildWhere(params, organizationId);
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : [
          { client: { favorite: "desc" as const } },
          { client: { name: "asc" as const } },
          { codSistemaSentenca: "asc" as const },
        ];

    const [data, total] = await Promise.all([
      prisma.filter.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tbc: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          lastBackupBy: { select: { id: true, name: true } },
        },
      }),
      prisma.filter.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string) {
    return filterRepository.findById(id, organizationId);
  },

  async getByIdWithRelations(id: string, organizationId: string) {
    return prisma.filter.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { client: true, tbc: true },
    });
  },

  async listDistinctSentenceCodes(organizationId: string) {
    const [coligadas, sistemas] = await Promise.all([
      prisma.filter.findMany({
        where: { organizationId, deletedAt: null, codColigadaSentenca: { not: "" } },
        distinct: ["codColigadaSentenca"],
        select: { codColigadaSentenca: true },
        orderBy: { codColigadaSentenca: "asc" },
      }),
      prisma.filter.findMany({
        where: { organizationId, deletedAt: null, codSistemaSentenca: { not: "" } },
        distinct: ["codSistemaSentenca"],
        select: { codSistemaSentenca: true },
        orderBy: { codSistemaSentenca: "asc" },
      }),
    ]);
    return {
      codigosColigada: coligadas.map((f) => f.codColigadaSentenca),
      codigosSistema: sistemas.map((f) => f.codSistemaSentenca),
    };
  },

  async create(input: CreateFilterInput, organizationId: string) {
    const nextRunAt = computeNextRunAt(input.schedule, new Date());
    return filterRepository.create({ ...input, organizationId, nextRunAt });
  },

  async update(id: string, input: UpdateFilterInput, organizationId: string) {
    // Re-anchor the schedule to "now" whenever it's (re)saved, per spec — a weekly/monthly
    // schedule fires from the moment the record was last saved, not from a fixed clock.
    const nextRunAt = input.schedule ? computeNextRunAt(input.schedule, new Date()) : undefined;
    return filterRepository.update(id, { ...input, ...(input.schedule ? { nextRunAt } : {}) }, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return filterRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return filterRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return filterRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return filterRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return filterRepository.bulkRestore(ids, organizationId);
  },
};
