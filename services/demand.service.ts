import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/repositories/base.repository";
import { assertClientAllowed } from "@/lib/client-access";
import { departmentsForRequesters } from "@/lib/demand-cascade";
import { applyListChange, resolveBulkSchedule } from "@/lib/demand-bulk";
import { timeToMinutes, type BulkUpdateDemandInput, type CreateDemandInput, type UpdateDemandInput } from "@/schemas/demand.schema";
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

  // Everything pointing at a demand is part of it (hidden with it on delete), never a reason to block deleting it.
  protected override ownedModels() {
    return ["Attachment", "Comment", "DemandTag", "DemandAnalyst", "DemandRequester", "DemandDepartment", "DemandDemandType"];
  }
}

export const demandRepository = new DemandRepository();

type ImpactItem = { id: string; name: string; color: string };

export interface DemandDeleteImpact {
  demandCount: number;
  clients: ImpactItem[];
  projects: ImpactItem[];
  projectTasks: ImpactItem[];
  analysts: ImpactItem[];
  requesters: ImpactItem[];
  departments: ImpactItem[];
  demandTypes: ImpactItem[];
  tags: ImpactItem[];
  commentCount: number;
  attachmentCount: number;
}

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
    | "minDuration"
    | "projectId",
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
    WHERE d.organization_id = ${organizationId} AND d.deleted_at IS NULL AND (
      ${matches(Prisma.sql`d.name`)}
      OR ${matches(Prisma.sql`d.description`)}
      OR ${matches(Prisma.sql`coalesce(d.notes, '')`)}
      OR ${matches(Prisma.sql`coalesce(c.name, '')`)}
      OR EXISTS (
        SELECT 1 FROM demand_analysts da JOIN analysts a ON a.id = da.analyst_id
        WHERE da.demand_id = d.id AND ${matches(Prisma.sql`a.name`)}
      )
      OR EXISTS (
        SELECT 1 FROM demand_requesters dr JOIN requesters r ON r.id = dr.requester_id
        WHERE dr.demand_id = d.id AND ${matches(Prisma.sql`r.name`)}
      )
      OR EXISTS (
        SELECT 1 FROM demand_departments dd JOIN departments dp ON dp.id = dd.department_id
        WHERE dd.demand_id = d.id AND ${matches(Prisma.sql`dp.name`)}
      )
      OR EXISTS (
        SELECT 1 FROM demand_demand_types ddt JOIN demand_types t ON t.id = ddt.demand_type_id
        WHERE ddt.demand_id = d.id AND ${matches(Prisma.sql`t.name`)}
      )
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
    ...(analystScope ? { demandAnalysts: { some: { analystId: analystScope } } } : {}),
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
  if (analystIds.length) and.push({ demandAnalysts: { some: { analystId: { in: analystIds } } } });
  const requesterIds = splitList(filters.requesterId);
  if (requesterIds.length) and.push({ demandRequesters: { some: { requesterId: { in: requesterIds } } } });
  const departmentIds = splitList(filters.departmentId);
  if (departmentIds.length) and.push({ demandDepartments: { some: { departmentId: { in: departmentIds } } } });
  const demandTypeIds = splitList(filters.demandTypeId);
  if (demandTypeIds.length) and.push({ demandDemandTypes: { some: { demandTypeId: { in: demandTypeIds } } } });
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

  const projectIds = splitList(filters.projectId);
  if (projectIds.includes("none")) and.push({ projectId: null });
  else if (projectIds.length) and.push({ projectId: { in: projectIds } });

  const minDuration = Number(filters.minDuration);
  if (minDuration > 0) and.push({ durationMinutes: { gte: minDuration } });

  if (params.search?.trim()) {
    and.push({ id: { in: await searchDemandIds(params.search.trim(), organizationId) } });
  }

  if (and.length) where.AND = and;
  return where;
}

export const demandIncludeRelations = {
  // orderBy on the join rows keeps the pick order stable (alphabetical) on every read.
  demandAnalysts: { select: { analyst: { select: { id: true, name: true, color: true, userId: true } } }, orderBy: { analyst: { name: "asc" } } },
  client: { select: { id: true, name: true, color: true } },
  demandRequesters: { select: { requester: { select: { id: true, name: true, color: true } } }, orderBy: { requester: { name: "asc" } } },
  demandDepartments: { select: { department: { select: { id: true, name: true, color: true } } }, orderBy: { department: { name: "asc" } } },
  demandDemandTypes: { select: { demandType: { select: { id: true, name: true, color: true } } }, orderBy: { demandType: { name: "asc" } } },
  demandTags: { include: { tag: true } },
  project: { select: { id: true, code: true, name: true, color: true } },
  projectTask: { select: { id: true, number: true, title: true } },
} as const;

/** Sort fields that live on a relation (DataTable column ids) → Prisma orderBy. */
function demandOrderBy(sort: { field: string; direction: "asc" | "desc" }): Prisma.DemandOrderByWithRelationInput {
  if (sort.field === "projectName") return { project: { name: sort.direction } };
  return safeOrderBy(sort);
}

/**
 * A demand linked to a project must be of the project's client (hours consume that client's
 * contract) and, when a task is given, the task must belong to the project.
 */
async function assertProjectLink(organizationId: string, allowedClientIds: string[], clientId: string, projectId?: string | null, projectTaskId?: string | null) {
  if (!projectId) {
    if (projectTaskId) throw new Error("Selecione o projeto da tarefa");
    return;
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
    select: { clientId: true, name: true },
  });
  if (!project) throw new Error("Projeto não encontrado ou fora do seu escopo de acesso");
  if (project.clientId !== clientId) throw new Error(`O cliente da demanda precisa ser o cliente do projeto ${project.name}`);
  if (projectTaskId) {
    const task = await prisma.projectTask.findFirst({ where: { id: projectTaskId, projectId, deletedAt: null }, select: { id: true } });
    if (!task) throw new Error("Tarefa não encontrada neste projeto");
  }
}

/**
 * Cliente → Solicitantes → Setores (lib/demand-cascade.ts): requesters must be of the demand's client
 * and departments must apply to that client and be linked to one of the chosen requesters. Links the demand already had are accepted as-is,
 * so editing a demand saved before the cascade existed doesn't fail on its legacy requesters/departments.
 */
async function assertPeopleLinks(
  organizationId: string,
  clientId: string,
  requesterIds: string[],
  departmentIds: string[],
  saved: { requesterIds: string[]; departmentIds: string[] } = { requesterIds: [], departmentIds: [] },
) {
  const [requesters, departments] = await Promise.all([
    requesterIds.length
      ? prisma.requester.findMany({ where: { id: { in: requesterIds }, organizationId, deletedAt: null }, select: { id: true, name: true, clientId: true } })
      : [],
    departmentIds.length
      ? prisma.department.findMany({
          where: { id: { in: departmentIds }, organizationId, deletedAt: null },
          select: {
            id: true,
            name: true,
            departmentClients: { select: { clientId: true } },
            departmentRequesters: { select: { requesterId: true } },
          },
        })
      : [],
  ]);
  const wrongRequesters = requesters.filter((r) => r.clientId !== clientId && !saved.requesterIds.includes(r.id));
  if (wrongRequesters.length) {
    throw new Error(`Solicitante(s) não vinculado(s) ao cliente da demanda: ${wrongRequesters.map((r) => r.name).join(", ")}`);
  }
  const options = departmentsForRequesters(
    departments.map((d) => ({
      id: d.id,
      clientIds: d.departmentClients.map((dc) => dc.clientId),
      requesterIds: d.departmentRequesters.map((dr) => dr.requesterId),
    })),
    clientId,
    requesterIds,
    saved.departmentIds,
  );
  const wrongDepartments = departments.filter((d) => !options.some((o) => o.id === d.id));
  if (wrongDepartments.length) {
    throw new Error(`Setor(es) não vinculado(s) ao cliente/solicitantes da demanda: ${wrongDepartments.map((d) => d.name).join(", ")}`);
  }
}

type LinkIds = { analystIds?: string[]; requesterIds?: string[]; departmentIds?: string[]; demandTypeIds?: string[] };

/**
 * Nested writes for the demand's analysts/requesters/departments/types. On update (`replace`) a
 * given list replaces the current links; an omitted list (undefined) keeps them.
 */
function demandLinks({ analystIds, requesterIds, departmentIds, demandTypeIds }: LinkIds, replace = false) {
  const unique = (ids: string[]) => [...new Set(ids.filter(Boolean))];
  const write = <K extends string>(ids: string[] | undefined, key: K) =>
    ids === undefined
      ? undefined
      : { ...(replace ? { deleteMany: {} } : {}), create: unique(ids).map((id) => ({ [key]: id }) as Record<K, string>) };
  return {
    demandAnalysts: write(analystIds, "analystId"),
    demandRequesters: write(requesterIds, "requesterId"),
    demandDepartments: write(departmentIds, "departmentId"),
    demandDemandTypes: write(demandTypeIds, "demandTypeId"),
  };
}

/** Whether the demand has the given analyst among its analysts (analyst-scoped users). */
export async function demandHasAnalyst(demandId: string, analystId: string) {
  return !!(await prisma.demandAnalyst.findUnique({ where: { demandId_analystId: { demandId, analystId } }, select: { demandId: true } }));
}

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
      ? [demandOrderBy(params.sort), { createdAt: "asc" as const }]
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
      projects: [] as { id: string; code: string; name: string; color: string }[],
      clients: [] as Client[],
      analysts: [] as { id: string; name: string; color: string }[],
      requesters: [] as { id: string; name: string; color: string }[],
      departments: [] as { id: string; name: string; color: string; clientIds: string[] }[],
      demandTypes: [] as { id: string; name: string; color: string }[],
      tags: [] as { id: string; name: string; color: string }[],
      priorities: [] as Priority[],
      statuses: [] as DemandStatus[],
      maxDurationMinutes: 0,
    };
    if (allowedClientIds.length === 0) return empty;

    const where = baseDemandWhere(organizationId, allowedClientIds, analystScope, period);
    // groupBy = SQL GROUP BY (Prisma's `distinct` would load every matching demand and de-duplicate in Node).
    const distinctIds = async (field: "clientId") => {
      const rows = await prisma.demand.groupBy({ by: [field], where });
      return rows.map((r) => (r as unknown as Record<string, string | null>)[field]).filter((v): v is string => !!v);
    };

    const projectRows = await prisma.demand.groupBy({ by: ["projectId"], where: { ...where, projectId: { not: null } } });
    const projects = projectRows.length
      ? await prisma.project.findMany({
          where: { id: { in: projectRows.map((r) => r.projectId!) } },
          select: { id: true, code: true, name: true, color: true },
          orderBy: { name: "asc" },
        })
      : [];
    const [clientIds, analystIds, requesterIds, departmentIds, demandTypeIds, tagRows, priorityRows, statusRows, maxDuration] =
      await Promise.all([
        distinctIds("clientId"),
        prisma.demandAnalyst.groupBy({ by: ["analystId"], where: { demand: where } }).then((rows) => rows.map((r) => r.analystId)),
        prisma.demandRequester.groupBy({ by: ["requesterId"], where: { demand: where } }).then((rows) => rows.map((r) => r.requesterId)),
        prisma.demandDepartment.groupBy({ by: ["departmentId"], where: { demand: where } }).then((rows) => rows.map((r) => r.departmentId)),
        prisma.demandDemandType.groupBy({ by: ["demandTypeId"], where: { demand: where } }).then((rows) => rows.map((r) => r.demandTypeId)),
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
        ? prisma.requester.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true, color: true }, ...byName })
        : [],
      departmentIds.length
        ? prisma.department
            .findMany({
              where: { id: { in: departmentIds } },
              select: { id: true, name: true, color: true, departmentClients: { select: { clientId: true } } },
              ...byName,
            })
            .then((rows) => rows.map(({ departmentClients, ...d }) => ({ ...d, clientIds: departmentClients.map((dc) => dc.clientId) })))
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
      projects,
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

    const analystClause = analystScope
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM demand_analysts da WHERE da.demand_id = demands.id AND da.analyst_id = ${analystScope})`
      : Prisma.empty;

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
    const { tagIds, analystIds, requesterIds, departmentIds, demandTypeIds, date, startTime, endTime, projectId, projectTaskId, ...rest } = input;
    await assertProjectLink(organizationId, allowedClientIds, input.clientId, projectId, projectTaskId);
    await assertPeopleLinks(organizationId, input.clientId, requesterIds ?? [], departmentIds ?? []);
    return prisma.demand.create({
      data: {
        ...rest,
        projectId: projectId || null,
        projectTaskId: projectTaskId || null,
        date: new Date(date),
        startTime: combineDateAndTime(date, startTime),
        endTime: combineDateAndTime(date, endTime),
        durationMinutes: timeToMinutes(endTime) - timeToMinutes(startTime),
        organizationId,
        demandTags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
        ...demandLinks({ analystIds, requesterIds, departmentIds, demandTypeIds }),
      },
      include: demandIncludeRelations,
    });
  },

  async update(id: string, input: UpdateDemandInput, organizationId: string, allowedClientIds: string[]) {
    if (input.clientId) assertClientAllowed(input.clientId, allowedClientIds);
    const existing = await prisma.demand.findFirst({
      where: { id, organizationId, clientId: { in: allowedClientIds } },
      include: { demandRequesters: { select: { requesterId: true } }, demandDepartments: { select: { departmentId: true } } },
    });
    if (!existing) throw new Error("Demanda não encontrada ou fora do seu escopo de acesso");

    const { tagIds, analystIds, requesterIds, departmentIds, demandTypeIds, date, startTime, endTime, projectId, projectTaskId, ...rest } = input;
    const nextProjectId = projectId === undefined ? existing.projectId : projectId || null;
    const nextTaskId = projectTaskId === undefined ? (projectId === "" ? null : existing.projectTaskId) : projectTaskId || null;
    await assertProjectLink(organizationId, allowedClientIds, input.clientId ?? existing.clientId, nextProjectId, nextTaskId);
    if (input.clientId || requesterIds || departmentIds) {
      const saved = {
        requesterIds: existing.demandRequesters.map((dr) => dr.requesterId),
        departmentIds: existing.demandDepartments.map((dd) => dd.departmentId),
      };
      await assertPeopleLinks(
        organizationId,
        input.clientId ?? existing.clientId,
        requesterIds ?? saved.requesterIds,
        departmentIds ?? saved.departmentIds,
        saved,
      );
    }
    if (tagIds) {
      await prisma.demandTag.deleteMany({ where: { demandId: id } });
    }
    const effectiveDate = date ?? existing.date.toISOString();

    return prisma.demand.update({
      where: { id, organizationId },
      data: {
        ...rest,
        projectId: nextProjectId,
        projectTaskId: nextTaskId,
        ...(date ? { date: new Date(date) } : {}),
        ...(startTime && effectiveDate ? { startTime: combineDateAndTime(effectiveDate, startTime) } : {}),
        ...(endTime && effectiveDate ? { endTime: combineDateAndTime(effectiveDate, endTime) } : {}),
        ...(startTime && endTime ? { durationMinutes: timeToMinutes(endTime) - timeToMinutes(startTime) } : {}),
        demandTags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
        ...demandLinks({ analystIds, requesterIds, departmentIds, demandTypeIds }, true),
      },
      include: demandIncludeRelations,
    });
  },

  /** Copies a demand (fields + tags, not attachments/comments) as a new PENDING demand. */
  async duplicate(id: string, organizationId: string, allowedClientIds: string[], analystScope?: string) {
    const existing = await this.getById(id, organizationId, allowedClientIds);
    if (!existing || (analystScope && !existing.demandAnalysts.some(({ analyst }) => analyst.id === analystScope))) {
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
        clientId: existing.clientId,
        projectId: existing.projectId,
        projectTaskId: existing.projectTaskId,
        demandTags: existing.demandTags.length
          ? { create: existing.demandTags.map(({ tag }) => ({ tagId: tag.id })) }
          : undefined,
        ...demandLinks({
          analystIds: existing.demandAnalysts.map(({ analyst }) => analyst.id),
          requesterIds: existing.demandRequesters.map(({ requester }) => requester.id),
          departmentIds: existing.demandDepartments.map(({ department }) => department.id),
          demandTypeIds: existing.demandDemandTypes.map(({ demandType }) => demandType.id),
        }),
      },
      include: demandIncludeRelations,
    });
  },

  /** Projects a demand can be linked to: in scope, with a client, not finished. */
  async listLinkableProjects(organizationId: string, allowedClientIds: string[]) {
    return prisma.project.findMany({
      where: { organizationId, deletedAt: null, clientId: { in: allowedClientIds }, status: { in: ["PLANNING", "IN_PROGRESS", "ON_HOLD"] } },
      select: { id: true, code: true, name: true, color: true, clientId: true },
      orderBy: { name: "asc" },
    });
  },

  /** Project/task links of the given demands — read before a delete/restore to re-sync task hours. */
  async projectLinks(ids: string[], organizationId: string) {
    const rows = await prisma.demand.findMany({
      where: { id: { in: ids }, organizationId, projectId: { not: null } },
      select: { projectId: true, projectTaskId: true },
    });
    return {
      projectIds: [...new Set(rows.map((r) => r.projectId!))],
      taskIds: [...new Set(rows.map((r) => r.projectTaskId).filter((id): id is string => !!id))],
    };
  },

  /** Clients of the demands — read before an edit that may move them to another client. */
  async clientIdsOf(ids: string[], organizationId: string) {
    const rows = await prisma.demand.findMany({ where: { id: { in: ids }, organizationId }, select: { clientId: true } });
    return [...new Set(rows.map((r) => r.clientId))];
  },

  /** What the demands are linked to — listed in the delete dialog, where it all disappears with them. */
  async deleteImpact(ids: string[], organizationId: string, allowedClientIds: string[]): Promise<DemandDeleteImpact> {
    const badge = { select: { id: true, name: true, color: true } } as const;
    const rows = await prisma.demand.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
      select: {
        client: badge,
        project: badge,
        projectTask: { select: { id: true, title: true } },
        demandAnalysts: { select: { analyst: badge } },
        demandRequesters: { select: { requester: badge } },
        demandDepartments: { select: { department: badge } },
        demandDemandTypes: { select: { demandType: badge } },
        demandTags: { select: { tag: badge } },
        _count: { select: { comments: true, attachments: true } },
      },
    });
    const distinct = (items: ImpactItem[]) => [...new Map(items.map((i) => [i.id, i])).values()];
    return {
      demandCount: rows.length,
      clients: distinct(rows.map((r) => r.client)),
      projects: distinct(rows.flatMap((r) => (r.project ? [r.project] : []))),
      projectTasks: distinct(rows.flatMap((r) => (r.projectTask ? [{ id: r.projectTask.id, name: r.projectTask.title, color: "#64748b" }] : []))),
      analysts: distinct(rows.flatMap((r) => r.demandAnalysts.map((l) => l.analyst))),
      requesters: distinct(rows.flatMap((r) => r.demandRequesters.map((l) => l.requester))),
      departments: distinct(rows.flatMap((r) => r.demandDepartments.map((l) => l.department))),
      demandTypes: distinct(rows.flatMap((r) => r.demandDemandTypes.map((l) => l.demandType))),
      tags: distinct(rows.flatMap((r) => r.demandTags.map((l) => l.tag))),
      commentCount: rows.reduce((sum, r) => sum + r._count.comments, 0),
      attachmentCount: rows.reduce((sum, r) => sum + r._count.attachments, 0),
    };
  },

  async softDelete(id: string, organizationId: string, allowedClientIds: string[]) {
    return demandRepository.softDelete(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  async restore(id: string, organizationId: string, allowedClientIds: string[]) {
    return demandRepository.restore(id, organizationId, { clientId: { in: allowedClientIds } });
  },

  /**
   * Applies the bulk edit to each demand on its own (same validation as a single edit): list fields
   * are resolved per demand (add/replace/remove) and the ones that fail are reported, not rolled back.
   */
  async bulkUpdate(ids: string[], input: BulkUpdateDemandInput, organizationId: string, allowedClientIds: string[], analystScope?: string) {
    const demands = await prisma.demand.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
      select: {
        id: true,
        name: true,
        clientId: true,
        startTime: true,
        endTime: true,
        demandAnalysts: { select: { analystId: true } },
        demandRequesters: { select: { requesterId: true } },
        demandDepartments: { select: { departmentId: true } },
        demandDemandTypes: { select: { demandTypeId: true } },
        demandTags: { select: { tagId: true } },
      },
    });
    const found = new Set(demands.map((d) => d.id));
    const failed: { id: string; name: string; reason: string }[] = ids
      .filter((id) => !found.has(id))
      .map((id) => ({ id, name: id, reason: "Demanda não encontrada ou fora do seu escopo de acesso" }));
    const updated: Awaited<ReturnType<typeof this.update>>[] = [];
    const { analystIds, requesterIds, departmentIds, demandTypeIds, tagIds, date, startTime, endTime, projectId, projectTaskId, ...simple } = input;

    for (const demand of demands) {
      try {
        const lists = {
          analystIds: applyListChange(demand.demandAnalysts.map((l) => l.analystId), analystIds),
          requesterIds: applyListChange(demand.demandRequesters.map((l) => l.requesterId), requesterIds),
          departmentIds: applyListChange(demand.demandDepartments.map((l) => l.departmentId), departmentIds),
          demandTypeIds: applyListChange(demand.demandDemandTypes.map((l) => l.demandTypeId), demandTypeIds),
        };
        const empty = (
          [
            ["analystIds", "analista"],
            ["requesterIds", "solicitante"],
            ["departmentIds", "setor"],
            ["demandTypeIds", "tipo"],
          ] as const
        ).find(([key]) => lists[key].length === 0);
        if (empty) throw new Error(`A demanda ficaria sem ${empty[1]}`);
        if (analystScope && (!demand.demandAnalysts.some((l) => l.analystId === analystScope) || !lists.analystIds.includes(analystScope))) {
          throw new Error("Você só pode editar demandas em que é analista");
        }

        const clientChanged = !!simple.clientId && simple.clientId !== demand.clientId;
        // A new client drops a project of the previous one unless a project was picked too.
        const project =
          projectId !== undefined
            ? { projectId, projectTaskId: projectTaskId ?? "" }
            : clientChanged
              ? { projectId: "", projectTaskId: "" }
              : {};

        // The schema only compares the times when both were edited; here the other one comes from the demand.
        const schedule = resolveBulkSchedule(demand, { date, startTime, endTime });
        if (schedule.startTime && schedule.endTime && timeToMinutes(schedule.endTime) <= timeToMinutes(schedule.startTime)) {
          throw new Error(`Hora de término (${schedule.endTime}) deve ser depois da hora de início (${schedule.startTime})`);
        }

        const entity = await this.update(
          demand.id,
          {
            ...simple,
            ...schedule,
            ...project,
            ...(analystIds ? { analystIds: lists.analystIds } : {}),
            ...(requesterIds ? { requesterIds: lists.requesterIds } : {}),
            ...(departmentIds ? { departmentIds: lists.departmentIds } : {}),
            ...(demandTypeIds ? { demandTypeIds: lists.demandTypeIds } : {}),
            tagIds: tagIds ? applyListChange(demand.demandTags.map((l) => l.tagId), tagIds) : undefined,
          } as UpdateDemandInput,
          organizationId,
          allowedClientIds,
        );
        updated.push(entity);
      } catch (error) {
        failed.push({ id: demand.id, name: demand.name, reason: (error as Error).message });
      }
    }
    return { updated, failed };
  },

  async bulkSoftDelete(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return demandRepository.bulkSoftDelete(ids, organizationId, { clientId: { in: allowedClientIds } });
  },

  async bulkRestore(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return demandRepository.bulkRestore(ids, organizationId, { clientId: { in: allowedClientIds } });
  },
};
