import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import { computeNextRunAt } from "@/lib/backup-schedule";
import { assertClientAllowed } from "@/lib/client-access";
import type { CreateFilterInput, UpdateFilterInput } from "@/schemas/filter.schema";
import type { ListParams } from "@/types/common";
import type { Filter } from "@/generated/prisma/client";

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
  async list(params: Parameters<typeof filterRepository.findAll>[0], organizationId: string, allowedClientIds: string[]) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await filterRepository.buildWhere(params, organizationId);
    where.clientId = { in: allowedClientIds };
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
          scheduleCategory: { select: { id: true, name: true } },
        },
      }),
      prisma.filter.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]) {
    return filterRepository.findById(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  async getByIdWithRelations(id: string, organizationId: string, allowedClientIds: string[]) {
    return prisma.filter.findFirst({
      where: { id, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
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

  async create(input: CreateFilterInput, organizationId: string, allowedClientIds: string[]) {
    assertClientAllowed(input.clientId, allowedClientIds);
    const nextRunAt = computeNextRunAt(input.schedule, new Date(), input.scheduleTime);
    return filterRepository.create({
      ...input,
      organizationId,
      nextRunAt,
      scheduleTime: input.scheduleTime || null,
      scheduleCategoryId: input.scheduleCategoryId || null,
    });
  },

  async update(id: string, input: UpdateFilterInput, organizationId: string, allowedClientIds: string[]) {
    if (input.clientId) assertClientAllowed(input.clientId, allowedClientIds);

    // Re-anchor the schedule to "now" only when the schedule actually changed — not on every save
    // of the filter (e.g. renaming it), which would otherwise silently push back a pending backup.
    let nextRunAt: Date | null | undefined;
    if (input.schedule !== undefined) {
      const current = await filterRepository.findById(id, organizationId, { clientId: { in: allowedClientIds } });
      const scheduleChanged =
        !current ||
        current.schedule !== input.schedule ||
        (current.scheduleTime ?? null) !== (input.scheduleTime || null) ||
        (current.scheduleCategoryId ?? null) !== (input.scheduleCategoryId || null);
      if (scheduleChanged) nextRunAt = computeNextRunAt(input.schedule, new Date(), input.scheduleTime);
    }

    return filterRepository.update(
      id,
      {
        ...input,
        ...(nextRunAt !== undefined ? { nextRunAt } : {}),
        ...(input.scheduleTime !== undefined ? { scheduleTime: input.scheduleTime || null } : {}),
        ...(input.scheduleCategoryId !== undefined ? { scheduleCategoryId: input.scheduleCategoryId || null } : {}),
      },
      organizationId,
      { clientId: { in: allowedClientIds } }
    );
  },

  async softDelete(id: string, organizationId: string, allowedClientIds: string[]) {
    return filterRepository.softDelete(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  async setStatus(id: string, status: boolean, organizationId: string, allowedClientIds: string[]) {
    return filterRepository.setStatus(id, status, organizationId, { clientId: { in: allowedClientIds } });
  },

  async restore(id: string, organizationId: string, allowedClientIds: string[]) {
    return filterRepository.restore(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  async bulkSoftDelete(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return filterRepository.bulkSoftDelete(ids, organizationId, { clientId: { in: allowedClientIds } });
  },

  async bulkRestore(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return filterRepository.bulkRestore(ids, organizationId, { clientId: { in: allowedClientIds } });
  },
};
