import { prisma } from "@/lib/prisma";
import type { ListParams, PaginationMeta } from "@/types/common";

export class BaseRepository<T extends { id: string; deletedAt: Date | null }> {
  constructor(
    protected model: any,
    protected searchFields: string[] = ["name"]
  ) {}

  buildWhere(input: ListParams & { status?: boolean }): Record<string, unknown> {
    const where: Record<string, unknown> = { deletedAt: null };

    if (input.filters) {
      for (const [key, value] of Object.entries(input.filters)) {
        if (value !== undefined && value !== "") {
          if (key === "status") {
            where[key] = value === "true" || value === true;
          } else {
            where[key] = value;
          }
        }
      }
    }

    if (input.search) {
      where.OR = this.searchFields.map((field) => ({
        [field]: { contains: input.search, mode: "insensitive" },
      }));
    }

    return where;
  }

  async findAll(params: ListParams & { status?: boolean }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = this.buildWhere(params);
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : { createdAt: "desc" as const };

    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.model.count({ where }),
    ]);

    return {
      data: data as T[],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      } as PaginationMeta,
    };
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id, deletedAt: null } }) as Promise<T | null>;
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create({ data }) as Promise<T>;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return this.model.update({ where: { id }, data }) as Promise<T>;
  }

  async softDelete(id: string): Promise<T> {
    return this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    }) as Promise<T>;
  }

  async restore(id: string): Promise<T> {
    return this.model.update({
      where: { id },
      data: { deletedAt: null },
    }) as Promise<T>;
  }

  async bulkSoftDelete(ids: string[]): Promise<number> {
    const result = await this.model.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  async bulkRestore(ids: string[]): Promise<number> {
    const result = await this.model.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });
    return result.count;
  }

  async listAll(): Promise<T[]> {
    return this.model.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" as const },
    }) as Promise<T[]>;
  }
}
