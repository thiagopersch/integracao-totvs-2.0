import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/repositories/base.repository";
import { assertClientAllowed } from "@/lib/client-access";
import { timeToMinutes, type CreateDemandInput, type UpdateDemandInput } from "@/schemas/demand.schema";
import type { Client, Demand, DemandStatus, Priority } from "@/generated/prisma/client";
import type { ListParams } from "@/types/common";
import { safeOrderBy } from "@/lib/sort";

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

const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const DEMAND_PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const DAY_MS = 24 * 60 * 60 * 1000;

type DateRange = { gte: Date; lt: Date };

/** Filter-panel params as they arrive from the URL: comma-separated id lists, yyyy-MM-dd dates, minutes. */
export type DemandListFilters = Partial<
  Record<
    | "clientId"
    | "analystId"
    | "requesterId"
    | "departmentId"
    | "demandTypeId"
    | "tagId"
    | "priority"
    | "status"
    | "dateFrom"
    | "dateTo"
    | "minDuration",
    string | boolean | undefined
  >
>;

function splitList(value: string | boolean | undefined): string[] {
  return typeof value === "string" ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

function parseDay(value: string | boolean | undefined): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Enum values whose pt-BR label (or raw value) contains the search term, accent/case-insensitive. */
function matchEnumLabels<T extends string>(labels: Record<T, string>, search: string): T[] {
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const term = normalize(search);
  return (Object.keys(labels) as T[]).filter((key) => normalize(labels[key]).includes(term) || normalize(key).includes(term));
}

/**
 * Ids of demands where the term appears in any column the table shows: name/description/notes,
 * client/analyst/requester/department/type/tag names, priority/status labels or the dd/mm/yyyy date.
 */
async function searchDemandIds(search: string, organizationId: string): Promise<string[]> {
  const pattern = `%${search}%`;
  const matches = (column: Prisma.Sql) => Prisma.sql`immutable_unaccent(lower(${column})) ILIKE immutable_unaccent(lower(${pattern}))`;
  const priorities = matchEnumLabels(DEMAND_PRIORITY_LABELS, search);
  const statuses = matchEnumLabels(DEMAND_STATUS_LABELS, search);

  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT d.id
    FROM demands d
    LEFT JOIN clients c ON c.id = d.client_id
    LEFT JOIN analysts a ON a.id = d.analyst_id
    LEFT JOIN requesters r ON r.id = d.requester_id
    LEFT JOIN departments dp ON dp.id = d.department_id
    LEFT JOIN demand_types t ON t.id = d.demand_type_id
    WHERE d.organization_id = ${organizationId} AND d.deleted_at IS NULL AND (
      ${matches(Prisma.sql`d.name`)}
      OR ${matches(Prisma.sql`d.description`)}
      OR ${matches(Prisma.sql`coalesce(d.notes, '')`)}
      OR ${matches(Prisma.sql`coalesce(c.name, '')`)}
      OR ${matches(Prisma.sql`coalesce(a.name, '')`)}
      OR ${matches(Prisma.sql`coalesce(r.name, '')`)}
      OR ${matches(Prisma.sql`coalesce(dp.name, '')`)}
      OR ${matches(Prisma.sql`coalesce(t.name, '')`)}
      OR to_char(d.date, 'DD/MM/YYYY') LIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM demand_tags dt JOIN tags tg ON tg.id = dt.tag_id
        WHERE dt.demand_id = d.id AND ${matches(Prisma.sql`tg.name`)}
      )
      ${priorities.length ? Prisma.sql`OR d.priority::text IN (${Prisma.join(priorities)})` : Prisma.empty}
      ${statuses.length ? Prisma.sql`OR d.status::text IN (${Prisma.join(statuses)})` : Prisma.empty}
    )
  `);
  return rows.map((r) => r.id);
}

/** Scope shared by the list and the filter options: tenant, allowed clients, analyst scope and the header period. */
function baseDemandWhere(
  organizationId: string,
  allowedClientIds: string[],
  analystScope?: string,
  period?: DateRange
): Prisma.DemandWhereInput {
  return {
    deletedAt: null,
    organizationId,
    clientId: { in: allowedClientIds },
    ...(analystScope ? { analystId: analystScope } : {}),
    ...(period ? { date: period } : {}),
  };
}

async function buildListWhere(
  params: ListParams,
  organizationId: string,
  allowedClientIds: string[],
  analystScope?: string,
  period?: DateRange
): Promise<Prisma.DemandWhereInput> {
  const where = baseDemandWhere(organizationId, allowedClientIds, analystScope, period);
  const and: Prisma.DemandWhereInput[] = [];
  const filters = (params.filters ?? {}) as DemandListFilters;

  const clientIds = splitList(filters.clientId).filter((id) => allowedClientIds.includes(id));
  if (splitList(filters.clientId).length) and.push({ clientId: { in: clientIds } });

  const analystIds = splitList(filters.analystId);
  if (analystIds.length) and.push({ analystId: { in: analystIds } });
  const requesterIds = splitList(filters.requesterId);
  if (requesterIds.length) and.push({ requesterId: { in: requesterIds } });
  const departmentIds = splitList(filters.departmentId);
  if (departmentIds.length) and.push({ departmentId: { in: departmentIds } });
  const demandTypeIds = splitList(filters.demandTypeId);
  if (demandTypeIds.length) and.push({ demandTypeId: { in: demandTypeIds } });
  const tagIds = splitList(filters.tagId);
  if (tagIds.length) and.push({ demandTags: { some: { tagId: { in: tagIds } } } });

  const priorities = splitList(filters.priority).filter((p): p is Priority => p in DEMAND_PRIORITY_LABELS);
  if (priorities.length) and.push({ priority: { in: priorities } });
  const statuses = splitList(filters.status).filter((s): s is DemandStatus => s in DEMAND_STATUS_LABELS);
  if (statuses.length) and.push({ status: { in: statuses } });

  // A single picked day (no end) filters just that day; on top of — not instead of — the header period.
  const dateFrom = parseDay(filters.dateFrom);
  if (dateFrom) {
    const dateTo = parseDay(filters.dateTo) ?? dateFrom;
    and.push({ date: { gte: dateFrom, lt: new Date(dateTo.getTime() + DAY_MS) } });
  }

  const minDuration = Number(filters.minDuration);
  if (minDuration > 0) and.push({ durationMinutes: { gte: minDuration } });

  if (params.search?.trim()) {
    and.push({ id: { in: await searchDemandIds(params.search.trim(), organizationId) } });
  }

  if (and.length) where.AND = and;
  return where;
}

export const demandIncludeRelations = {
  analyst: { select: { id: true, name: true, color: true } },
  client: { select: { id: true, name: true, color: true } },
  requester: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  demandType: { select: { id: true, name: true, color: true } },
  demandTags: { include: { tag: true } },
} as const;

export const demandService = {
  async list(
    params: ListParams,
    organizationId: string,
    allowedClientIds: string[],
    analystScope?: string,
    period?: DateRange
  ) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await buildListWhere(params, organizationId, allowedClientIds, analystScope, period);
    const orderBy = params.sort
      ? [safeOrderBy(params.sort), { createdAt: "asc" as const }]
      : [{ date: "desc" as const }, { createdAt: "asc" as const }];

    const [data, total, totalsRaw] = await Promise.all([
      prisma.demand.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: demandIncludeRelations }),
      prisma.demand.count({ where }),
      prisma.demand.groupBy({ by: ["clientId"], where, _sum: { durationMinutes: true } }),
    ]);

    const clientIds = totalsRaw.map((t) => t.clientId);
    const clients = clientIds.length
      ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true, color: true } })
      : [];
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const totalsByClient = totalsRaw
      .map((t) => ({
        clientId: t.clientId,
        clientName: clientById.get(t.clientId)?.name ?? "-",
        clientColor: clientById.get(t.clientId)?.color ?? "#22c55e",
        hours: Math.round(((t._sum.durationMinutes ?? 0) / 60) * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, totalsByClient };
  },

  /**
   * Values the filter panel offers: only clients/analysts/requesters/departments/types/tags/
   * priorities/statuses that actually appear on a demand within `period` (and the user's scope).
   */
  async getFilterOptions(organizationId: string, allowedClientIds: string[], analystScope?: string, period?: DateRange) {
    const empty = {
      clients: [] as Client[],
      analysts: [] as { id: string; name: string; color: string }[],
      requesters: [] as { id: string; name: string }[],
      departments: [] as { id: string; name: string }[],
      demandTypes: [] as { id: string; name: string; color: string }[],
      tags: [] as { id: string; name: string; color: string }[],
      priorities: [] as Priority[],
      statuses: [] as DemandStatus[],
      maxDurationMinutes: 0,
    };
    if (allowedClientIds.length === 0) return empty;

    const where = baseDemandWhere(organizationId, allowedClientIds, analystScope, period);
    // groupBy = SQL GROUP BY (Prisma's `distinct` would load every matching demand and de-duplicate in Node).
    const distinctIds = async (field: "clientId" | "analystId" | "requesterId" | "departmentId" | "demandTypeId") => {
      const rows = await prisma.demand.groupBy({ by: [field], where });
      return rows.map((r) => (r as unknown as Record<string, string | null>)[field]).filter((v): v is string => !!v);
    };

    const [clientIds, analystIds, requesterIds, departmentIds, demandTypeIds, tagRows, priorityRows, statusRows, maxDuration] =
      await Promise.all([
        distinctIds("clientId"),
        distinctIds("analystId"),
        distinctIds("requesterId"),
        distinctIds("departmentId"),
        distinctIds("demandTypeId"),
        prisma.demandTag.groupBy({ by: ["tagId"], where: { demand: where } }),
        prisma.demand.groupBy({ by: ["priority"], where }),
        prisma.demand.groupBy({ by: ["status"], where }),
        prisma.demand.aggregate({ where, _max: { durationMinutes: true } }),
      ]);

    const byName = { orderBy: { name: "asc" as const } };
    const [clients, analysts, requesters, departments, demandTypes, tags] = await Promise.all([
      clientIds.length ? prisma.client.findMany({ where: { id: { in: clientIds }, deletedAt: null }, ...byName }) : [],
      analystIds.length
        ? prisma.analyst.findMany({ where: { id: { in: analystIds } }, select: { id: true, name: true, color: true }, ...byName })
        : [],
      requesterIds.length
        ? prisma.requester.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true }, ...byName })
        : [],
      departmentIds.length
        ? prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true }, ...byName })
        : [],
      demandTypeIds.length
        ? prisma.demandType.findMany({ where: { id: { in: demandTypeIds } }, select: { id: true, name: true, color: true }, ...byName })
        : [],
      tagRows.length
        ? prisma.tag.findMany({ where: { id: { in: tagRows.map((t) => t.tagId) } }, select: { id: true, name: true, color: true }, ...byName })
        : [],
    ]);

    const presentPriorities = new Set(priorityRows.map((p) => p.priority));
    const presentStatuses = new Set(statusRows.map((s) => s.status));

    return {
      clients,
      analysts,
      requesters,
      departments,
      demandTypes,
      tags,
      priorities: (Object.keys(DEMAND_PRIORITY_LABELS) as Priority[]).filter((p) => presentPriorities.has(p)),
      statuses: (Object.keys(DEMAND_STATUS_LABELS) as DemandStatus[]).filter((s) => presentStatuses.has(s)),
      maxDurationMinutes: maxDuration._max.durationMinutes ?? 0,
    };
  },

  /** Distinct year/month combos present in the user's visible demands, for the dynamic period picker. */
  async getAvailablePeriods(organizationId: string, allowedClientIds: string[], analystScope?: string) {
    if (allowedClientIds.length === 0) return { years: [] as number[], monthsByYear: {} as Record<number, number[]> };

    const analystClause = analystScope ? Prisma.sql`AND analyst_id = ${analystScope}` : Prisma.empty;

    const rows = await prisma.$queryRaw<{ year: number; month: number }[]>(
      Prisma.sql`
        SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS year, EXTRACT(MONTH FROM date)::int AS month
        FROM demands
        WHERE deleted_at IS NULL AND organization_id = ${organizationId}
          AND client_id IN (${Prisma.join(allowedClientIds)})
          ${analystClause}
        ORDER BY year DESC, month ASC
      `
    );

    // The current year is always offered first — even with no demands logged for it yet — so it's
    // one click away instead of requiring scrolling to find it once older years accumulate.
    const currentYear = new Date().getFullYear();
    const years = [...new Set(rows.map((r) => r.year))];
    if (!years.includes(currentYear)) years.push(currentYear);
    years.sort((a, b) => (a === currentYear ? -1 : b === currentYear ? 1 : b - a));

    const monthsByYear = rows.reduce<Record<number, number[]>>((acc, r) => {
      (acc[r.year] ??= []).push(r.month);
      return acc;
    }, {});

    return { years, monthsByYear };
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]) {
    return prisma.demand.findFirst({
      where: { id, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
      include: demandIncludeRelations,
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
      include: demandIncludeRelations,
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
      include: demandIncludeRelations,
    });
  },

  /** Copies a demand (fields + tags, not attachments/comments) as a new PENDING demand. */
  async duplicate(id: string, organizationId: string, allowedClientIds: string[], analystScope?: string) {
    const existing = await this.getById(id, organizationId, allowedClientIds);
    if (!existing || (analystScope && existing.analystId !== analystScope)) {
      throw new Error("Demanda não encontrada ou fora do seu escopo de acesso");
    }

    return prisma.demand.create({
      data: {
        organizationId,
        name: `${existing.name} (cópia)`.slice(0, 155),
        description: existing.description,
        date: existing.date,
        startTime: existing.startTime,
        endTime: existing.endTime,
        durationMinutes: existing.durationMinutes,
        priority: existing.priority,
        status: "PENDING",
        notes: existing.notes,
        analystId: existing.analystId,
        clientId: existing.clientId,
        requesterId: existing.requesterId,
        departmentId: existing.departmentId,
        demandTypeId: existing.demandTypeId,
        demandTags: existing.demandTags.length
          ? { create: existing.demandTags.map(({ tag }) => ({ tagId: tag.id })) }
          : undefined,
      },
      include: demandIncludeRelations,
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
