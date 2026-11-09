import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Cursor-paginated autocomplete for the large registries (`GET /api/lookup/[entity]`). Keyset
 * pagination on (label, id) — stable and cheap however deep the user scrolls — with the same
 * accent/case-insensitive match the list screens use (`immutable_unaccent`, pg_trgm-indexed).
 *
 * Contract consumed by the client `AsyncAutocomplete`:
 *   { items: { id, label, color? }[], nextCursor: string | null }
 */
export type LookupItem = { id: string; label: string; color?: string | null };
export type LookupPage = { items: LookupItem[]; nextCursor: string | null };

export type LookupScope = {
  organizationId: string;
  allowedClientIds: string[];
  /** Restricts demands to one analyst (users without analysts:read), see lib/demand-scope.ts. */
  analystScope?: string;
};

type EntityConfig = {
  table: string;
  /** SQL expression for the label shown (and sorted/searched on). Uses alias `t`. */
  label: Prisma.Sql;
  color?: boolean;
  where: (scope: LookupScope) => Prisma.Sql;
};

const orgAndLive = (scope: LookupScope) => Prisma.sql`t."organization_id" = ${scope.organizationId} AND t."deleted_at" IS NULL`;
const clientScoped = (scope: LookupScope, column = "client_id") =>
  scope.allowedClientIds.length
    ? Prisma.sql`t.${Prisma.raw(`"${column}"`)} IN (${Prisma.join(scope.allowedClientIds)})`
    : Prisma.sql`FALSE`;

export const LOOKUP_ENTITIES = {
  clients: {
    table: "clients",
    label: Prisma.sql`t."name"`,
    color: true,
    where: (s) => Prisma.sql`${orgAndLive(s)} AND t."status" = TRUE AND ${clientScoped(s, "id")}`,
  },
  requesters: {
    table: "requesters",
    label: Prisma.sql`t."name"`,
    color: true,
    where: (s) => Prisma.sql`${orgAndLive(s)} AND t."status" = TRUE`,
  },
  analysts: {
    table: "analysts",
    label: Prisma.sql`t."name"`,
    color: true,
    where: (s) => Prisma.sql`${orgAndLive(s)} AND t."status" = TRUE`,
  },
  departments: { table: "departments", label: Prisma.sql`t."name"`, color: true, where: orgAndLive },
  "demand-types": { table: "demand_types", label: Prisma.sql`t."name"`, color: true, where: orgAndLive },
  tags: { table: "tags", label: Prisma.sql`t."name"`, color: true, where: (s) => Prisma.sql`t."organization_id" = ${s.organizationId}` },
  projects: {
    table: "projects",
    label: Prisma.sql`(t."code" || ' — ' || t."name")`,
    color: true,
    // Internal projects (no client) are visible to everyone with access; client projects follow the client scope.
    where: (s) => Prisma.sql`${orgAndLive(s)} AND (t."client_id" IS NULL OR ${clientScoped(s)})`,
  },
  demands: {
    table: "demands",
    label: Prisma.sql`(to_char(t."date", 'DD/MM/YYYY') || ' — ' || t."name")`,
    where: (s) =>
      Prisma.sql`${orgAndLive(s)} AND ${clientScoped(s)}${
        s.analystScope
          ? Prisma.sql` AND EXISTS (SELECT 1 FROM "demand_analysts" da WHERE da."demand_id" = t."id" AND da."analyst_id" = ${s.analystScope})`
          : Prisma.empty
      }`,
  },
} satisfies Record<string, EntityConfig>;

export type LookupEntity = keyof typeof LOOKUP_ENTITIES;

export function isLookupEntity(value: string): value is LookupEntity {
  return Object.prototype.hasOwnProperty.call(LOOKUP_ENTITIES, value);
}

export function encodeCursor(label: string, id: string): string {
  return Buffer.from(JSON.stringify([label, id])).toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): [string, string] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((v) => typeof v === "string")) return parsed as [string, string];
  } catch {
    // malformed cursor → first page
  }
  return null;
}

export const MAX_LOOKUP_LIMIT = 50;

export const lookupService = {
  async search(
    entity: LookupEntity,
    scope: LookupScope,
    options: { q?: string; cursor?: string | null; limit?: number; ids?: string[] }
  ): Promise<LookupPage> {
    const config: EntityConfig = LOOKUP_ENTITIES[entity];
    const limit = Math.min(Math.max(options.limit ?? 20, 1), MAX_LOOKUP_LIMIT);
    const table = Prisma.raw(`"${config.table}"`);
    const color = config.color ? Prisma.sql`t."color"` : Prisma.sql`NULL::text`;

    // Resolve labels of already-selected values (e.g. a form opened on an existing record).
    if (options.ids?.length) {
      const rows = await prisma.$queryRaw<LookupItem[]>`
        SELECT t."id", ${config.label} AS "label", ${color} AS "color"
        FROM ${table} t
        WHERE ${config.where(scope)} AND t."id" IN (${Prisma.join(options.ids.slice(0, MAX_LOOKUP_LIMIT))})
        ORDER BY 2, 1`;
      return { items: rows, nextCursor: null };
    }

    const q = options.q?.trim();
    const search = q
      ? Prisma.sql` AND immutable_unaccent(lower(${config.label})) LIKE immutable_unaccent(lower(${`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}))`
      : Prisma.empty;
    // Sorted case- and accent-insensitively ("ação" next to "Acao"), independent of the DB collation.
    const sortKey = Prisma.sql`immutable_unaccent(lower(${config.label}))`;
    const after = decodeCursor(options.cursor);
    const keyset = after
      ? Prisma.sql` AND (${sortKey} COLLATE "C", t."id") > (${after[0]}::text COLLATE "C", ${after[1]}::text)`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<(LookupItem & { sortKey: string })[]>`
      SELECT t."id", ${config.label} AS "label", ${color} AS "color", ${sortKey} AS "sortKey"
      FROM ${table} t
      WHERE ${config.where(scope)}${search}${keyset}
      ORDER BY ${sortKey} COLLATE "C", t."id"
      LIMIT ${limit + 1}`;

    const hasMore = rows.length > limit;
    const page = (hasMore ? rows.slice(0, limit) : rows);
    const last = page[page.length - 1];
    return {
      items: page.map(({ id, label, color: itemColor }) => ({ id, label, color: itemColor })),
      nextCursor: hasMore && last ? encodeCursor(last.sortKey, last.id) : null,
    };
  },
};
