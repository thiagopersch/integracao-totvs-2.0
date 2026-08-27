import { prisma } from "@/lib/prisma";
import { ENTITY_LABELS } from "@/lib/entity-relations";
import { ACTION_LABELS } from "@/lib/audit-labels";
import { BULK_DELETE_BLOCKED_ACTION } from "@/services/audit.service";
import type { AuditLog, SoapLog, EmailLog, ApiLog, Prisma } from "@prisma/client";

export type ActivitySource = "CRUD" | "SOAP" | "EMAIL" | "API";
export type ActivityStatus = "OK" | "ERROR" | "SKIPPED";

export type ActivityRow = {
  id: string;
  source: ActivitySource;
  summary: string;
  actorName: string | null;
  status: ActivityStatus;
  durationMs: number | null;
  createdAt: Date;
  raw: unknown;
};

export type ActivityFilters = {
  source?: ActivitySource;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

type AuditLogWithUser = AuditLog & { user: { name: string } | null };
type SoapLogWithUser = SoapLog & { user: { name: string } | null };
type EmailLogWithUser = EmailLog & { user: { name: string } | null };
type ApiLogWithUser = ApiLog & { user: { name: string } | null };

function normalizeAudit(row: AuditLogWithUser): ActivityRow {
  const entityLabel = ENTITY_LABELS[row.entity] ?? row.entity;
  const actionLabel = ACTION_LABELS[row.action] ?? row.action.toLowerCase();
  return {
    id: row.id,
    source: "CRUD",
    summary: `${actionLabel} em ${entityLabel}`,
    actorName: row.user?.name ?? "Sistema",
    status: "OK",
    durationMs: null,
    createdAt: row.createdAt,
    raw: row,
  };
}

function normalizeSoap(row: SoapLogWithUser): ActivityRow {
  return {
    id: row.id,
    source: "SOAP",
    summary: `${row.method ?? "?"} ${row.process ?? ""}`.trim(),
    actorName: row.user?.name ?? "Sistema",
    status: row.error || (row.status !== null && row.status >= 400) ? "ERROR" : "OK",
    durationMs: row.duration,
    createdAt: row.createdAt,
    raw: row,
  };
}

function normalizeEmail(row: EmailLogWithUser): ActivityRow {
  return {
    id: row.id,
    source: "EMAIL",
    summary: `${row.subject} → ${row.to}`,
    actorName: row.user?.name ?? "Sistema",
    status: row.status === "SENT" ? "OK" : row.status === "SKIPPED" ? "SKIPPED" : "ERROR",
    durationMs: null,
    createdAt: row.createdAt,
    raw: row,
  };
}

function normalizeApi(row: ApiLogWithUser): ActivityRow {
  return {
    id: row.id,
    source: "API",
    summary: `${row.integration}: ${row.httpMethod} ${row.url}`,
    actorName: row.user?.name ?? "Sistema",
    status: row.error || (row.httpStatus !== null && row.httpStatus >= 400) ? "ERROR" : "OK",
    durationMs: row.duration,
    createdAt: row.createdAt,
    raw: row,
  };
}

function dateRange(filters: ActivityFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) };
}

function auditWhere(organizationId: string, filters: ActivityFilters): Prisma.AuditLogWhereInput {
  const createdAt = dateRange(filters);
  return {
    organizationId,
    action: { not: BULK_DELETE_BLOCKED_ACTION },
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ entity: { contains: filters.search, mode: "insensitive" } }, { action: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

function soapWhere(organizationId: string, filters: ActivityFilters): Prisma.SoapLogWhereInput {
  const createdAt = dateRange(filters);
  return {
    organizationId,
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ dataserver: { contains: filters.search, mode: "insensitive" } }, { process: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

function emailWhere(organizationId: string, filters: ActivityFilters): Prisma.EmailLogWhereInput {
  const createdAt = dateRange(filters);
  return {
    organizationId,
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ subject: { contains: filters.search, mode: "insensitive" } }, { to: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

function apiWhere(organizationId: string, filters: ActivityFilters): Prisma.ApiLogWhereInput {
  const createdAt = dateRange(filters);
  return {
    organizationId,
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ integration: { contains: filters.search, mode: "insensitive" } }, { url: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

const userSelect = { user: { select: { name: true } } } as const;

export const activityLogService = {
  /** Paginated, unified feed across AuditLog + SoapLog + EmailLog + ApiLog.
   *
   * With `filters.source` set, delegates to that table's own exact `skip`/`take` — cheap, correct
   * pagination. With no source filter ("todas as fontes"), there's no single SQL table to paginate
   * against, so this over-fetches the `page * pageSize` most recent rows from each of the 4 tables,
   * merges + sorts them in memory, and slices out the current page's window. That cost grows with
   * page depth — acceptable at today's volume; if it ever becomes a problem, replace this branch
   * with a `$queryRaw` UNION ALL across the 4 tables instead.
   */
  async list(organizationId: string, page = 1, pageSize = 20, filters: ActivityFilters = {}) {
    if (filters.source) {
      return this.listSource(filters.source, organizationId, page, pageSize, filters);
    }

    const take = page * pageSize;
    const [auditRows, soapRows, emailRows, apiRows] = await Promise.all([
      prisma.auditLog.findMany({ where: auditWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: "desc" }, take }),
      prisma.soapLog.findMany({ where: soapWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: "desc" }, take }),
      prisma.emailLog.findMany({ where: emailWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: "desc" }, take }),
      prisma.apiLog.findMany({ where: apiWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: "desc" }, take }),
    ]);

    const merged = [
      ...auditRows.map(normalizeAudit),
      ...soapRows.map(normalizeSoap),
      ...emailRows.map(normalizeEmail),
      ...apiRows.map(normalizeApi),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const windowStart = (page - 1) * pageSize;
    const data = merged.slice(windowStart, windowStart + pageSize);

    const [auditTotal, soapTotal, emailTotal, apiTotal] = await Promise.all([
      prisma.auditLog.count({ where: auditWhere(organizationId, filters) }),
      prisma.soapLog.count({ where: soapWhere(organizationId, filters) }),
      prisma.emailLog.count({ where: emailWhere(organizationId, filters) }),
      prisma.apiLog.count({ where: apiWhere(organizationId, filters) }),
    ]);
    const total = auditTotal + soapTotal + emailTotal + apiTotal;

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async listSource(source: ActivitySource, organizationId: string, page: number, pageSize: number, filters: ActivityFilters) {
    const skip = (page - 1) * pageSize;

    if (source === "CRUD") {
      const where = auditWhere(organizationId, filters);
      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({ where, include: userSelect, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
        prisma.auditLog.count({ where }),
      ]);
      return { data: rows.map(normalizeAudit), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    if (source === "SOAP") {
      const where = soapWhere(organizationId, filters);
      const [rows, total] = await Promise.all([
        prisma.soapLog.findMany({ where, include: userSelect, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
        prisma.soapLog.count({ where }),
      ]);
      return { data: rows.map(normalizeSoap), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    if (source === "EMAIL") {
      const where = emailWhere(organizationId, filters);
      const [rows, total] = await Promise.all([
        prisma.emailLog.findMany({ where, include: userSelect, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
        prisma.emailLog.count({ where }),
      ]);
      return { data: rows.map(normalizeEmail), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    const where = apiWhere(organizationId, filters);
    const [rows, total] = await Promise.all([
      prisma.apiLog.findMany({ where, include: userSelect, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.apiLog.count({ where }),
    ]);
    return { data: rows.map(normalizeApi), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },
};
