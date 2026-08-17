import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateFilterInput, UpdateFilterInput } from "@/schemas/filter.schema";
import type { Filter } from "@prisma/client";

class FilterRepository extends BaseRepository<Filter> {
  constructor() {
    super(prisma.filter, ["filter", "codSystemContext", "userContext"]);
  }
}

export const filterRepository = new FilterRepository();

export const filterService = {
  async list(params: Parameters<typeof filterRepository.findAll>[0]) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = filterRepository.buildWhere(params);
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : { createdAt: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.filter.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { tbc: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } },
      }),
      prisma.filter.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string) {
    return filterRepository.findById(id);
  },

  async create(input: CreateFilterInput) {
    return filterRepository.create(input as any);
  },

  async update(id: string, input: UpdateFilterInput) {
    return filterRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return filterRepository.softDelete(id);
  },

  async restore(id: string) {
    return filterRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return filterRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return filterRepository.bulkRestore(ids);
  },
};
