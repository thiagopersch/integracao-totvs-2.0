import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { DictionaryRow } from "@/lib/totvs-dictionary";
import type { ListParams, PaginationMeta } from "@/types/common";

/** TOTVS RM data dictionary (`totvs_dictionary_columns`) — global to every organization. */

const SORTABLE = new Set(["table", "column", "description"]);
const UPSERT_BATCH = 5000;

export interface DictionaryFilters {
  search?: string;
  table?: string;
  tablesOnly?: boolean;
}

function whereOf(f: DictionaryFilters): Prisma.TotvsDictionaryColumnWhereInput {
  const and: Prisma.TotvsDictionaryColumnWhereInput[] = [];
  const search = f.search?.trim();
  if (search) {
    and.push({
      OR: [
        { table: { contains: search, mode: "insensitive" } },
        { column: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (f.table?.trim()) and.push({ table: f.table.trim().toUpperCase() });
  if (f.tablesOnly) and.push({ column: "#" });
  return and.length ? { AND: and } : {};
}

function orderOf(sort: ListParams["sort"]): Prisma.TotvsDictionaryColumnOrderByWithRelationInput[] {
  if (sort && SORTABLE.has(sort.field)) {
    const primary = { [sort.field]: sort.direction } as Prisma.TotvsDictionaryColumnOrderByWithRelationInput;
    return sort.field === "table" ? [primary, { column: "asc" }] : [primary, { table: "asc" }, { column: "asc" }];
  }
  return [{ table: "asc" }, { column: "asc" }];
}

export const totvsDictionaryService = {
  filtersFrom(params: ListParams): DictionaryFilters {
    return {
      search: params.search,
      table: typeof params.filters?.table === "string" ? params.filters.table : undefined,
      tablesOnly: params.filters?.tablesOnly === true || params.filters?.tablesOnly === "true",
    };
  },

  async list(params: ListParams): Promise<{ data: DictionaryRow[]; meta: PaginationMeta }> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(Math.max(1, params.pageSize ?? 25), 500);
    const where = whereOf(this.filtersFrom(params));
    const [data, total] = await Promise.all([
      prisma.totvsDictionaryColumn.findMany({ where, orderBy: orderOf(params.sort), skip: (page - 1) * pageSize, take: pageSize }),
      prisma.totvsDictionaryColumn.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  },

  /** Distinct table names (for the filter), with their description when there is a "#" row. */
  async searchTables(search: string, limit = 50): Promise<{ table: string; description: string | null }[]> {
    const q = search.trim().toUpperCase();
    const rows = await prisma.totvsDictionaryColumn.findMany({
      where: q ? { table: { contains: q } } : {},
      distinct: ["table"],
      select: { table: true },
      orderBy: { table: "asc" },
      take: limit,
    });
    const tables = rows.map((r) => r.table);
    const described = await prisma.totvsDictionaryColumn.findMany({ where: { table: { in: tables }, column: "#" }, select: { table: true, description: true } });
    const byTable = new Map(described.map((d) => [d.table, d.description]));
    return tables.map((table) => ({ table, description: byTable.get(table) ?? null }));
  },

  /** Every row matching the filters, in pages — for the export. */
  async *iterate(filters: DictionaryFilters, chunk = 5000): AsyncGenerator<DictionaryRow[]> {
    const where = whereOf(filters);
    let cursor: { table: string; column: string } | undefined;
    for (;;) {
      const rows = await prisma.totvsDictionaryColumn.findMany({
        where,
        orderBy: [{ table: "asc" }, { column: "asc" }],
        take: chunk,
        ...(cursor ? { skip: 1, cursor: { table_column: cursor } } : {}),
      });
      if (rows.length === 0) return;
      yield rows;
      if (rows.length < chunk) return;
      const last = rows[rows.length - 1];
      cursor = { table: last.table, column: last.column };
    }
  },

  async count(): Promise<number> {
    return prisma.totvsDictionaryColumn.count();
  },

  async create(row: DictionaryRow): Promise<DictionaryRow> {
    const exists = await prisma.totvsDictionaryColumn.findUnique({ where: { table_column: { table: row.table, column: row.column } } });
    if (exists) throw new Error(`Já existe ${row.column === "#" ? "a descrição da tabela" : "o campo"} ${row.table}.${row.column} no dicionário`);
    return prisma.totvsDictionaryColumn.create({ data: row });
  },

  /** Updates a row; changing table/column moves it to the new key (refused when that key exists). */
  async update(key: { table: string; column: string }, row: DictionaryRow): Promise<{ before: DictionaryRow; after: DictionaryRow }> {
    const before = await prisma.totvsDictionaryColumn.findUnique({ where: { table_column: key } });
    if (!before) throw new Error("Registro não encontrado no dicionário");
    const moved = key.table !== row.table || key.column !== row.column;
    if (moved) {
      const clash = await prisma.totvsDictionaryColumn.findUnique({ where: { table_column: { table: row.table, column: row.column } } });
      if (clash) throw new Error(`Já existe ${row.table}.${row.column} no dicionário`);
    }
    const after = await prisma.totvsDictionaryColumn.update({ where: { table_column: key }, data: row });
    return { before, after };
  },

  /** Nothing references the dictionary, so there is no blocking check — every key found is removed. */
  async remove(keys: { table: string; column: string }[]): Promise<number> {
    if (keys.length === 0) return 0;
    const result = await prisma.totvsDictionaryColumn.deleteMany({ where: { OR: keys.map((k) => ({ table: k.table, column: k.column })) } });
    return result.count;
  },

  /**
   * Upserts one batch (inserts new pairs, refreshes the description of existing ones) and stamps
   * `updated_at` on every row it touches. Duplicated pairs inside the batch keep the last one.
   */
  async upsertBatch(rows: DictionaryRow[]): Promise<{ inserted: number; updated: number }> {
    const unique = [...new Map(rows.map((r) => [`${r.table}|${r.column}`, r])).values()];
    if (unique.length === 0) return { inserted: 0, updated: 0 };
    // unnest keeps it at 3 parameters whatever the batch size; xmax = 0 only on freshly inserted tuples.
    const result = await prisma.$queryRaw<{ inserted: number; updated: number }[]>`
      WITH up AS (
        INSERT INTO "totvs_dictionary_columns" ("table","column","description","updated_at")
        SELECT t, c, d, now() FROM unnest(${unique.map((r) => r.table)}::text[], ${unique.map((r) => r.column)}::text[], ${unique.map((r) => r.description)}::text[]) AS x(t, c, d)
        ON CONFLICT ("table","column") DO UPDATE SET "description" = EXCLUDED."description", "updated_at" = now()
        RETURNING (xmax = 0) AS inserted
      )
      SELECT count(*) FILTER (WHERE inserted)::int AS inserted, count(*) FILTER (WHERE NOT inserted)::int AS updated FROM up`;
    return result[0] ?? { inserted: 0, updated: 0 };
  },

  /** "replace" finish: removes every row the import did not write (written before `startedAt`). */
  async finalizeReplace(startedAt: Date): Promise<number> {
    return (await prisma.totvsDictionaryColumn.deleteMany({ where: { updatedAt: { lt: startedAt } } })).count;
  },

  /** Database clock — the reference for `finalizeReplace`, so app/DB clock skew cannot delete fresh rows. */
  async now(): Promise<Date> {
    const [{ now }] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    return now;
  },

  /**
   * Imports rows in batches: "merge" inserts new pairs and refreshes existing ones; "replace" also
   * removes, at the end, the rows the file did not contain — a failure midway keeps the old content.
   */
  async import(rows: DictionaryRow[], mode: "merge" | "replace", onProgress?: (done: number, total: number) => void): Promise<{ inserted: number; updated: number; removed: number; total: number }> {
    const startedAt = await this.now();
    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const chunk = rows.slice(i, i + UPSERT_BATCH);
      const r = await this.upsertBatch(chunk);
      inserted += r.inserted;
      updated += r.updated;
      onProgress?.(Math.min(i + chunk.length, rows.length), rows.length);
    }
    const removed = mode === "replace" ? await this.finalizeReplace(startedAt) : 0;
    return { inserted, updated, removed, total: await this.count() };
  },
};
