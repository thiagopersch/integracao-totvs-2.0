import { prisma } from "@/lib/prisma";
import { ENTITY_LABELS, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations";
import { ACTION_LABELS } from "@/lib/audit-labels";
import { BULK_DELETE_BLOCKED_ACTION, RESTORE_ERROR_ACTION } from "@/services/audit.service";
import { STATUS_SYMBOLS } from "@/lib/activity-status";
import { SoapMethod, type AuditLog, type SoapLog, type EmailLog, type ApiLog, type Prisma } from "@/generated/prisma/client";

export type ActivitySource = "CRUD" | "SOAP" | "EMAIL" | "API" | "DELETION";
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

/** "<category>:<rawValue>" — category ties the value back to the source-specific field it filters
 *  (crud/deletion → AuditLog.entity, soap → SoapEndpointType id, api → ApiLog.integration). */
export type ActivityTipoValue = `crud:${string}` | `deletion:${string}` | `soap:${string}` | `api:${string}`;

export type ActivityFilters = {
  source?: ActivitySource;
  clientId?: string;
  tbcId?: string;
  tipo?: string;
  method?: string;
  /** "dataserver:<id>" or "process:<id>" — an id from the `Dataserver`/`Process` catalogs (the same
   *  ones /soap/builder lets the user pick from). Resolved to that record's `code` and matched
   *  against the `<DataServerName>`/`<ProcessServerName>` tag the builder embeds in `xmlRequest`. */
  dataserverProcess?: string;
  /** Real HTTP-style codes ("200", "401", ...) for SOAP/API mixed with `STATUS_SYMBOLS` values
   *  for the sources that have no numeric code. */
  status?: string[];
  minDurationMs?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

type AuditLogWithUser = AuditLog & { user: { name: string } | null };
type SoapLogWithUser = SoapLog & { user: { name: string } | null };
type EmailLogWithUser = EmailLog & { user: { name: string } | null };
type ApiLogWithUser = ApiLog & { user: { name: string } | null };

/** Never equals a real row id — used to force a source's query to zero rows when an active filter
 *  has no meaning for that source's data (e.g. "Método" on CRUD/E-mail, which have no method field). */
const NEVER_MATCH = "00000000-0000-0000-0000-000000000000";

const SOAP_METHOD_VALUES = new Set<string>(Object.values(SoapMethod));

/** Every external HTTP integration that writes `ApiLog` (`actions/integrations/tpi.ts`,
 *  `actions/integrations/cielo.ts` — grep `prisma.apiLog.create` to keep this in sync if a new
 *  integration is added). Listed as a fixed catalog, like SOAP's endpoint types, so the option
 *  shows up in "Tipo" even before that integration has ever been called. */
const API_INTEGRATIONS = [
  { code: "TPI", label: "TPI" },
  { code: "CIELO", label: "Cielo" },
] as const;

type RestoreErrorData = {
  code?: string;
  codColigada?: string | null;
  codSystem?: string | null;
  targetTbcName?: string;
  error?: string;
};

function normalizeAudit(row: AuditLogWithUser): ActivityRow {
  if (row.action === RESTORE_ERROR_ACTION) {
    const d = (row.newData as RestoreErrorData | null) ?? {};
    return {
      id: row.id,
      source: "CRUD",
      summary: `Falha ao restaurar consulta ${d.code ?? "?"} (${d.codColigada ?? "?"}/${d.codSystem ?? "?"}) no TBC ${d.targetTbcName ?? "?"}: ${d.error ?? "erro desconhecido"}`,
      actorName: row.user?.name ?? "Sistema",
      status: "ERROR",
      durationMs: null,
      createdAt: row.createdAt,
      raw: row,
    };
  }
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

function normalizeDeletion(row: AuditLogWithUser): ActivityRow {
  const entityLabel = ENTITY_LABELS[row.entity] ?? row.entity;
  const reasons = (row.newData as { reasons?: BlockingReference[] } | null)?.reasons ?? [];
  const reasonsLabel = formatBlockingReferences(reasons);
  return {
    id: row.id,
    source: "DELETION",
    summary: `Exclusão bloqueada: ${entityLabel}${reasonsLabel ? ` (${reasonsLabel})` : ""}`,
    actorName: row.user?.name ?? "Sistema",
    status: "SKIPPED",
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

function parseCategoryValue(tipo?: string): { category: string; value: string } | undefined {
  if (!tipo) return undefined;
  const idx = tipo.indexOf(":");
  if (idx === -1) return undefined;
  return { category: tipo.slice(0, idx), value: tipo.slice(idx + 1) };
}

/** Resolved once per `list()`/`listSource()` call — the async lookups (Tbc → link, endpoint type →
 *  suffix) that the sync `*Where` builders below need, since SoapLog has no real
 *  clientId/tbcId/endpointTypeId columns: `dataserver`/`process` are matched as strings instead. */
type FilterContext = {
  dataserverConstraint?: string | { in: string[] };
  soapProcessSuffix?: string;
  /** Resolved from `filters.dataserverProcess` — the exact `<DataServerName>`/`<ProcessServerName>`
   *  tag text (with the catalog record's `code` already substituted) to search for in `xmlRequest`. */
  dataserverProcessXmlNeedle?: string;
};

async function buildFilterContext(organizationId: string, filters: ActivityFilters): Promise<FilterContext> {
  const ctx: FilterContext = {};

  if (filters.tbcId) {
    const tbc = await prisma.tbc.findFirst({ where: { id: filters.tbcId, organizationId }, select: { link: true } });
    ctx.dataserverConstraint = tbc?.link ?? NEVER_MATCH;
  } else if (filters.clientId) {
    const tbcs = await prisma.tbc.findMany({
      where: { clientId: filters.clientId, organizationId, deletedAt: null },
      select: { link: true },
    });
    ctx.dataserverConstraint = { in: tbcs.map((t) => t.link) };
  }

  const tipo = parseCategoryValue(filters.tipo);
  if (tipo?.category === "soap") {
    const endpointType = await prisma.soapEndpointType.findUnique({ where: { id: tipo.value }, select: { suffix: true } });
    ctx.soapProcessSuffix = endpointType?.suffix ?? NEVER_MATCH;
  }

  const dataserverProcess = parseCategoryValue(filters.dataserverProcess);
  if (dataserverProcess?.category === "dataserver") {
    const row = await prisma.dataserver.findFirst({ where: { id: dataserverProcess.value, organizationId }, select: { code: true } });
    ctx.dataserverProcessXmlNeedle = row ? `<DataServerName>${row.code}</DataServerName>` : NEVER_MATCH;
  } else if (dataserverProcess?.category === "process") {
    const row = await prisma.process.findFirst({ where: { id: dataserverProcess.value, organizationId }, select: { code: true } });
    ctx.dataserverProcessXmlNeedle = row ? `<ProcessServerName>${row.code}</ProcessServerName>` : NEVER_MATCH;
  }

  return ctx;
}

/** True when `clientId`/`tbcId`/`dataserverProcess`/`method`/duration filters are active that this
 *  source can never satisfy — e.g. "Cliente" only means anything for SOAP calls. */
function hasClientTbcFilter(filters: ActivityFilters): boolean {
  return !!(filters.clientId || filters.tbcId);
}

function hasDurationFilter(filters: ActivityFilters): boolean {
  return filters.minDurationMs !== undefined;
}

function durationConstraint(filters: ActivityFilters): Prisma.IntFilter | undefined {
  if (filters.minDurationMs === undefined) return undefined;
  return { gte: filters.minDurationMs };
}

/** Splits the selected "Status" values into numeric HTTP-style codes (SOAP/API) and the
 *  `STATUS_SYMBOLS` entries (CRUD/E-mail/Deletion) so each source's `*Where` builder only
 *  reacts to the half of the filter that applies to it. */
function splitStatusFilter(status?: string[]): { codes: number[]; symbols: Set<string> } {
  const codes: number[] = [];
  const symbols = new Set<string>();
  for (const value of status ?? []) {
    const n = Number(value);
    if (Number.isFinite(n) && String(n) === value) codes.push(n);
    else symbols.add(value);
  }
  return { codes, symbols };
}

function auditWhere(organizationId: string, filters: ActivityFilters): Prisma.AuditLogWhereInput {
  const createdAt = dateRange(filters);
  const tipo = parseCategoryValue(filters.tipo);

  if (hasClientTbcFilter(filters) || filters.method || filters.dataserverProcess || hasDurationFilter(filters)) {
    return { id: NEVER_MATCH };
  }
  if (filters.status?.length && !splitStatusFilter(filters.status).symbols.has(STATUS_SYMBOLS.CRUD_OK)) {
    return { id: NEVER_MATCH };
  }
  if (tipo && tipo.category !== "crud") return { id: NEVER_MATCH };

  return {
    organizationId,
    action: { not: BULK_DELETE_BLOCKED_ACTION },
    ...(tipo?.category === "crud" ? { entity: tipo.value } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ entity: { contains: filters.search, mode: "insensitive" } }, { action: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

function deletionWhere(organizationId: string, filters: ActivityFilters): Prisma.AuditLogWhereInput {
  const createdAt = dateRange(filters);
  const tipo = parseCategoryValue(filters.tipo);

  if (hasClientTbcFilter(filters) || filters.method || filters.dataserverProcess || hasDurationFilter(filters)) {
    return { id: NEVER_MATCH };
  }
  if (filters.status?.length && !splitStatusFilter(filters.status).symbols.has(STATUS_SYMBOLS.DELETION_BLOCKED)) {
    return { id: NEVER_MATCH };
  }
  if (tipo && tipo.category !== "deletion") return { id: NEVER_MATCH };

  return {
    organizationId,
    action: BULK_DELETE_BLOCKED_ACTION,
    ...(tipo?.category === "deletion" ? { entity: tipo.value } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search ? { OR: [{ entity: { contains: filters.search, mode: "insensitive" } }] } : {}),
  };
}

function soapWhere(organizationId: string, filters: ActivityFilters, ctx: FilterContext): Prisma.SoapLogWhereInput {
  const createdAt = dateRange(filters);
  const tipo = parseCategoryValue(filters.tipo);

  if (tipo && tipo.category !== "soap") return { id: NEVER_MATCH };
  if (filters.method && !SOAP_METHOD_VALUES.has(filters.method)) return { id: NEVER_MATCH };

  let statusConstraint: Prisma.SoapLogWhereInput = {};
  if (filters.status?.length) {
    const { codes } = splitStatusFilter(filters.status);
    if (!codes.length) return { id: NEVER_MATCH };
    statusConstraint = { status: { in: codes } };
  }

  const duration = durationConstraint(filters);

  return {
    organizationId,
    ...(ctx.dataserverConstraint ? { dataserver: ctx.dataserverConstraint } : {}),
    ...(ctx.soapProcessSuffix ? { process: ctx.soapProcessSuffix } : {}),
    ...(filters.method ? { method: filters.method as SoapMethod } : {}),
    ...(duration ? { duration } : {}),
    ...statusConstraint,
    ...(createdAt ? { createdAt } : {}),
    ...(ctx.dataserverProcessXmlNeedle
      ? { xmlRequest: { contains: ctx.dataserverProcessXmlNeedle, mode: "insensitive" } }
      : {}),
    ...(filters.search
      ? { OR: [{ dataserver: { contains: filters.search, mode: "insensitive" } }, { process: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

function emailWhere(organizationId: string, filters: ActivityFilters): Prisma.EmailLogWhereInput {
  const createdAt = dateRange(filters);
  const tipo = parseCategoryValue(filters.tipo);

  if (hasClientTbcFilter(filters) || filters.method || filters.dataserverProcess || hasDurationFilter(filters) || tipo) {
    return { id: NEVER_MATCH };
  }

  let statusConstraint: Prisma.EmailLogWhereInput = {};
  if (filters.status?.length) {
    const { symbols } = splitStatusFilter(filters.status);
    const mapped: ("SENT" | "FAILED" | "SKIPPED")[] = [];
    if (symbols.has(STATUS_SYMBOLS.EMAIL_SENT)) mapped.push("SENT");
    if (symbols.has(STATUS_SYMBOLS.EMAIL_FAILED)) mapped.push("FAILED");
    if (symbols.has(STATUS_SYMBOLS.EMAIL_SKIPPED)) mapped.push("SKIPPED");
    if (!mapped.length) return { id: NEVER_MATCH };
    statusConstraint = { status: { in: mapped } };
  }

  return {
    organizationId,
    ...statusConstraint,
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ subject: { contains: filters.search, mode: "insensitive" } }, { to: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

function apiWhere(organizationId: string, filters: ActivityFilters): Prisma.ApiLogWhereInput {
  const createdAt = dateRange(filters);
  const tipo = parseCategoryValue(filters.tipo);

  if (hasClientTbcFilter(filters) || filters.dataserverProcess) return { id: NEVER_MATCH };
  if (tipo && tipo.category !== "api") return { id: NEVER_MATCH };

  let statusConstraint: Prisma.ApiLogWhereInput = {};
  if (filters.status?.length) {
    const { codes } = splitStatusFilter(filters.status);
    if (!codes.length) return { id: NEVER_MATCH };
    statusConstraint = { httpStatus: { in: codes } };
  }

  const duration = durationConstraint(filters);

  return {
    organizationId,
    ...(tipo?.category === "api" ? { integration: tipo.value } : {}),
    ...(filters.method ? { httpMethod: { equals: filters.method, mode: "insensitive" } } : {}),
    ...(duration ? { duration } : {}),
    ...statusConstraint,
    ...(createdAt ? { createdAt } : {}),
    ...(filters.search
      ? { OR: [{ integration: { contains: filters.search, mode: "insensitive" } }, { url: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };
}

const userSelect = { user: { select: { name: true } } } as const;

export const activityLogService = {
  /** Paginated, unified feed across AuditLog (CRUD + blocked-deletion) + SoapLog + EmailLog + ApiLog
   *  — the single grid backing every tab of /admin/activity. "Fonte" separates origins via a column
   *  and filter instead of separate pages, so every filter (Cliente, TBC, Tipo, Método,
   *  Dataserver/Processo, Status, Duração, Período) applies across all 5 sources at once; a filter
   *  that has no meaning for a given source (e.g. "Método" on CRUD) forces that source to zero rows
   *  rather than silently ignoring the filter.
   *
   * With `filters.source` set, delegates to that table's own exact `skip`/`take` — cheap, correct
   * pagination. With no source filter ("todas as fontes"), there's no single SQL table to paginate
   * against, so this over-fetches the `page * pageSize` most recent rows from each of the 5 tables,
   * merges + sorts them in memory, and slices out the current page's window. That cost grows with
   * page depth — acceptable at today's volume; if it ever becomes a problem, replace this branch
   * with a `$queryRaw` UNION ALL across the tables instead.
   */
  async list(
    organizationId: string,
    page = 1,
    pageSize = 20,
    filters: ActivityFilters = {},
    sort?: { field: "createdAt"; direction: "asc" | "desc" }
  ) {
    const ctx = await buildFilterContext(organizationId, filters);
    const direction = sort?.direction ?? "desc";

    if (filters.source) {
      return this.listSource(filters.source, organizationId, page, pageSize, filters, ctx, direction);
    }

    const take = page * pageSize;
    const [auditRows, soapRows, emailRows, apiRows, deletionRows] = await Promise.all([
      prisma.auditLog.findMany({ where: auditWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: direction }, take }),
      prisma.soapLog.findMany({ where: soapWhere(organizationId, filters, ctx), include: userSelect, orderBy: { createdAt: direction }, take }),
      prisma.emailLog.findMany({ where: emailWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: direction }, take }),
      prisma.apiLog.findMany({ where: apiWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: direction }, take }),
      prisma.auditLog.findMany({ where: deletionWhere(organizationId, filters), include: userSelect, orderBy: { createdAt: direction }, take }),
    ]);

    const merged = [
      ...auditRows.map(normalizeAudit),
      ...soapRows.map(normalizeSoap),
      ...emailRows.map(normalizeEmail),
      ...apiRows.map(normalizeApi),
      ...deletionRows.map(normalizeDeletion),
    ].sort((a, b) => (direction === "desc" ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime()));

    const windowStart = (page - 1) * pageSize;
    const data = merged.slice(windowStart, windowStart + pageSize);

    const [auditTotal, soapTotal, emailTotal, apiTotal, deletionTotal] = await Promise.all([
      prisma.auditLog.count({ where: auditWhere(organizationId, filters) }),
      prisma.soapLog.count({ where: soapWhere(organizationId, filters, ctx) }),
      prisma.emailLog.count({ where: emailWhere(organizationId, filters) }),
      prisma.apiLog.count({ where: apiWhere(organizationId, filters) }),
      prisma.auditLog.count({ where: deletionWhere(organizationId, filters) }),
    ]);
    const total = auditTotal + soapTotal + emailTotal + apiTotal + deletionTotal;

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async listSource(
    source: ActivitySource,
    organizationId: string,
    page: number,
    pageSize: number,
    filters: ActivityFilters,
    ctx?: FilterContext,
    direction: "asc" | "desc" = "desc"
  ) {
    const skip = (page - 1) * pageSize;
    const resolvedCtx = ctx ?? (await buildFilterContext(organizationId, filters));
    const orderBy = { createdAt: direction };

    if (source === "CRUD") {
      const where = auditWhere(organizationId, filters);
      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({ where, include: userSelect, orderBy, skip, take: pageSize }),
        prisma.auditLog.count({ where }),
      ]);
      return { data: rows.map(normalizeAudit), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    if (source === "DELETION") {
      const where = deletionWhere(organizationId, filters);
      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({ where, include: userSelect, orderBy, skip, take: pageSize }),
        prisma.auditLog.count({ where }),
      ]);
      return { data: rows.map(normalizeDeletion), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    if (source === "SOAP") {
      const where = soapWhere(organizationId, filters, resolvedCtx);
      const [rows, total] = await Promise.all([
        prisma.soapLog.findMany({ where, include: userSelect, orderBy, skip, take: pageSize }),
        prisma.soapLog.count({ where }),
      ]);
      return { data: rows.map(normalizeSoap), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    if (source === "EMAIL") {
      const where = emailWhere(organizationId, filters);
      const [rows, total] = await Promise.all([
        prisma.emailLog.findMany({ where, include: userSelect, orderBy, skip, take: pageSize }),
        prisma.emailLog.count({ where }),
      ]);
      return { data: rows.map(normalizeEmail), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    const where = apiWhere(organizationId, filters);
    const [rows, total] = await Promise.all([
      prisma.apiLog.findMany({ where, include: userSelect, orderBy, skip, take: pageSize }),
      prisma.apiLog.count({ where }),
    ]);
    return { data: rows.map(normalizeApi), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  /** Distinct option lists for the "Tipo" filter — one group per source, values prefixed so the
   *  service knows which field to filter on regardless of which "Fonte" (if any) is also selected. */
  async listTipoOptions(organizationId: string) {
    const [crudEntities, deletionEntities] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId, action: { not: BULK_DELETE_BLOCKED_ACTION } },
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      }),
      prisma.auditLog.findMany({
        where: { organizationId, action: BULK_DELETE_BLOCKED_ACTION },
        distinct: ["entity"],
        select: { entity: true },
        orderBy: { entity: "asc" },
      }),
    ]);

    return {
      crud: crudEntities.map((r) => ({ value: `crud:${r.entity}` as const, label: `CRUD — ${ENTITY_LABELS[r.entity] ?? r.entity}` })),
      deletion: deletionEntities.map((r) => ({ value: `deletion:${r.entity}` as const, label: `Exclusão — ${ENTITY_LABELS[r.entity] ?? r.entity}` })),
      api: API_INTEGRATIONS.map((i) => ({ value: `api:${i.code}` as const, label: `API — ${i.label}` })),
    };
  },

  async listDistinctApiMethods(organizationId: string) {
    const rows = await prisma.apiLog.findMany({
      where: { organizationId },
      distinct: ["httpMethod"],
      select: { httpMethod: true },
      orderBy: { httpMethod: "asc" },
    });
    return rows.map((r) => r.httpMethod);
  },

  /** Distinct real HTTP-style codes seen in SoapLog.status / ApiLog.httpStatus — feeds the "Status"
   *  MultiSelect alongside the fixed `STATUS_SYMBOLS` entries for the sources with no such code. */
  async listStatusCodes(organizationId: string) {
    const [soapStatuses, apiStatuses] = await Promise.all([
      prisma.soapLog.findMany({
        where: { organizationId, status: { not: null } },
        distinct: ["status"],
        select: { status: true },
      }),
      prisma.apiLog.findMany({
        where: { organizationId, httpStatus: { not: null } },
        distinct: ["httpStatus"],
        select: { httpStatus: true },
      }),
    ]);
    const codes = new Set<number>();
    for (const r of soapStatuses) if (r.status !== null) codes.add(r.status);
    for (const r of apiStatuses) if (r.httpStatus !== null) codes.add(r.httpStatus);
    return Array.from(codes).sort((a, b) => a - b);
  },
};
