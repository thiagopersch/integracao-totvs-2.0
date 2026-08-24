import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ListParams, PaginationMeta } from "@/types/common";

function toColumnName(field: string): string {
  return field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

/**
 * Minimal shape of a Prisma model delegate (e.g. `prisma.client`) that
 * BaseRepository relies on. Kept loose on the `where`/`data` payloads
 * (each Prisma model has its own generated WhereInput/CreateInput/etc.)
 * since BaseRepository builds those generically across every entity.
 */
export interface CrudDelegate<T> {
  findMany(args: { where: Record<string, unknown>; orderBy: Record<string, unknown>; skip?: number; take?: number }): Promise<T[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findFirst(args: { where: Record<string, unknown> }): Promise<T | null>;
  create(args: { data: Record<string, unknown> }): Promise<T>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<T>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
}

export class BaseRepository<T extends { id: string; deletedAt: Date | null }> {
  constructor(
    protected model: CrudDelegate<T>,
    protected searchFields: string[] = ["name"],
    protected tableName?: string
  ) {}

  /**
   * Resolves matching row ids via a raw, accent- and case-insensitive query
   * (Postgres unaccent + pg_trgm, see prisma/migrations/*_add_organization_and_business_domain).
   * Falls back to undefined (caller uses a plain `contains` clause) when no
   * tableName was configured for this repository.
   */
  private async resolveSearchIds(search: string, organizationId?: string): Promise<string[] | undefined> {
    if (!search || !this.tableName) return undefined;

    const columns = this.searchFields.map(toColumnName);
    const conditions = columns
      .map(
        (col) =>
          Prisma.sql`immutable_unaccent(lower(${Prisma.raw(`"${col}"`)})) ILIKE immutable_unaccent(lower(${"%" + search + "%"}))`
      )
      .reduce((acc, cond) => Prisma.sql`${acc} OR ${cond}`);

    const orgClause = organizationId ? Prisma.sql`AND "organization_id" = ${organizationId}` : Prisma.sql``;

    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM ${Prisma.raw(`"${this.tableName}"`)} WHERE (${conditions}) ${orgClause}`
    );
    return rows.map((r) => r.id);
  }

  async buildWhere(input: ListParams & { status?: boolean }, organizationId?: string): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (organizationId) where.organizationId = organizationId;

    if (input.filters) {
      for (const [key, value] of Object.entries(input.filters)) {
        if (value !== undefined && value !== "") {
          if (value === "true" || value === "false") {
            where[key] = value === "true";
          } else {
            where[key] = value;
          }
        }
      }
    }

    if (input.search) {
      const ids = await this.resolveSearchIds(input.search, organizationId);
      if (ids) {
        where.id = { in: ids };
      } else {
        where.OR = this.searchFields.map((field) => ({
          [field]: { contains: input.search, mode: "insensitive" },
        }));
      }
    }

    return where;
  }

  async findAll(params: ListParams & { status?: boolean }, organizationId?: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await this.buildWhere(params, organizationId);
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

  async findById(id: string, organizationId?: string): Promise<T | null> {
    return this.model.findFirst({
      where: { id, deletedAt: null, ...(organizationId ? { organizationId } : {}) },
    }) as Promise<T | null>;
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create({ data }) as Promise<T>;
  }

  async update(id: string, data: Partial<T>, organizationId?: string): Promise<T> {
    return this.model.update({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      data,
    }) as Promise<T>;
  }

  async softDelete(id: string, organizationId?: string): Promise<T> {
    return this.model.update({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      data: { deletedAt: new Date() },
    }) as Promise<T>;
  }

  async restore(id: string, organizationId?: string): Promise<T> {
    return this.model.update({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      data: { deletedAt: null },
    }) as Promise<T>;
  }

  async bulkSoftDelete(ids: string[], organizationId?: string): Promise<number> {
    const result = await this.model.updateMany({
      where: { id: { in: ids }, ...(organizationId ? { organizationId } : {}) },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  async bulkRestore(ids: string[], organizationId?: string): Promise<number> {
    const result = await this.model.updateMany({
      where: { id: { in: ids }, ...(organizationId ? { organizationId } : {}) },
      data: { deletedAt: null },
    });
    return result.count;
  }

  async listAll(organizationId?: string): Promise<T[]> {
    return this.model.findMany({
      where: { deletedAt: null, ...(organizationId ? { organizationId } : {}) },
      orderBy: { name: "asc" as const },
    }) as Promise<T[]>;
  }
}
