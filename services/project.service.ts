import { prisma } from "@/lib/prisma";
import { Prisma, type Project } from "@/generated/prisma/client";
import { BaseRepository } from "@/repositories/base.repository";
import { findBlockingReferences, formatBlockingReferences } from "@/lib/entity-relations";
import { assertClientAllowed } from "@/lib/client-access";
import { getTodayDateOnly } from "@/lib/export-period";
import { computeHealth, computeProjectProgress, type HealthResult } from "@/lib/project-metrics";
import {
  CLOSED_TASK_STATUSES,
  DEFAULT_STAGES,
  PRIORITIES,
  PROJECT_STATUSES,
  parseProjectSettings,
  type ProjectHealth,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/projects";
import {
  CUSTOM_FIELD_PARAM_PREFIX,
  buildCustomFieldWhere,
  customFieldSortKey,
  parseCustomFieldValues,
  type CustomFieldDef,
} from "@/lib/custom-fields";
import { customFieldService } from "@/services/custom-field.service";
import { POSITION_STEP } from "@/lib/project-tasks";
import type { ProjectInput, ProjectRiskInput } from "@/schemas/project.schema";
import type { ListParams, PaginationMeta } from "@/types/common";

export type ProjectCtx = { organizationId: string; userId: string; allowedClientIds: string[] };
type Tx = Prisma.TransactionClient;

class ProjectRepository extends BaseRepository<Project> {
  constructor() {
    super(prisma.project, ["name", "code", "description", "sponsorName"], "projects", "Project");
  }
}

export const projectRepository = new ProjectRepository();

/** Projects without a client are internal (visible to anyone with projects:read); client
 *  projects follow the per-user client scope (UserClient). */
export function projectScopeWhere(allowedClientIds: string[]): Prisma.ProjectWhereInput {
  return { OR: [{ clientId: null }, { clientId: { in: allowedClientIds } }] };
}

const toDateOrNull = (value?: string | null) => (value ? new Date(value) : null);

const projectInclude = {
  client: { select: { id: true, name: true, color: true } },
  contract: { select: { id: true, contractedHours: true, status: true, startDate: true, endDate: true } },
  manager: { select: { id: true, name: true, image: true } },
  members: {
    select: { userId: true, role: true, allocationPercent: true, user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  stages: {
    where: { deletedAt: null },
    select: { id: true, name: true, color: true, category: true, wipLimit: true },
    orderBy: { position: "asc" as const },
  },
  phases: {
    where: { deletedAt: null },
    select: { id: true, name: true, color: true, startDate: true, endDate: true, description: true },
    orderBy: { position: "asc" as const },
  },
} satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export type ProjectTaskStats = {
  taskCount: number;
  openCount: number;
  doneCount: number;
  blockedCount: number;
  overdueCount: number;
  loggedMinutes: number;
};

const EMPTY_STATS: ProjectTaskStats = { taskCount: 0, openCount: 0, doneCount: 0, blockedCount: 0, overdueCount: 0, loggedMinutes: 0 };

async function loadTaskStats(projectIds: string[], today: Date): Promise<Map<string, ProjectTaskStats>> {
  const stats = new Map<string, ProjectTaskStats>();
  if (projectIds.length === 0) return stats;
  const [byStatus, overdue] = await Promise.all([
    prisma.projectTask.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: projectIds }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.projectTask.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: projectIds },
        deletedAt: null,
        dueDate: { lt: today },
        status: { notIn: [...CLOSED_TASK_STATUSES] },
      },
      _count: { _all: true },
    }),
  ]);
  for (const row of byStatus) {
    const entry = stats.get(row.projectId) ?? { ...EMPTY_STATS };
    const count = row._count._all;
    entry.taskCount += count;
    if (row.status === "DONE") entry.doneCount += count;
    if (row.status === "BLOCKED") entry.blockedCount += count;
    if (!CLOSED_TASK_STATUSES.includes(row.status as TaskStatus)) entry.openCount += count;
    stats.set(row.projectId, entry);
  }
  // Hours = demands linked to the project (with or without a task).
  const demandMinutes = await prisma.demand.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds }, deletedAt: null },
    _sum: { durationMinutes: true },
  });
  for (const row of demandMinutes) {
    if (!row.projectId) continue;
    const entry = stats.get(row.projectId) ?? { ...EMPTY_STATS };
    entry.loggedMinutes = row._sum.durationMinutes ?? 0;
    stats.set(row.projectId, entry);
  }
  for (const row of overdue) {
    const entry = stats.get(row.projectId) ?? { ...EMPTY_STATS };
    entry.overdueCount = row._count._all;
    stats.set(row.projectId, entry);
  }
  return stats;
}

function decorate(project: ProjectWithRelations, stats: ProjectTaskStats, today: Date) {
  const loggedHours = Math.round((stats.loggedMinutes / 60) * 10) / 10;
  const health: HealthResult = computeHealth({
    manual: project.health,
    status: project.status,
    plannedStartDate: project.plannedStartDate,
    plannedEndDate: project.plannedEndDate,
    progress: project.progress,
    openCount: stats.openCount,
    overdueCount: stats.overdueCount,
    blockedCount: stats.blockedCount,
    loggedHours,
    budgetHours: project.budgetHours,
    today,
  });
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    description: project.description,
    objective: project.objective,
    scope: project.scope,
    outOfScope: project.outOfScope,
    assumptions: project.assumptions,
    successCriteria: project.successCriteria,
    sponsorName: project.sponsorName,
    status: project.status,
    manualHealth: project.health,
    health: health.health,
    healthAuto: health.auto,
    healthReasons: health.reasons,
    priority: project.priority,
    color: project.color,
    plannedStartDate: project.plannedStartDate,
    plannedEndDate: project.plannedEndDate,
    actualStartDate: project.actualStartDate,
    actualEndDate: project.actualEndDate,
    budgetHours: project.budgetHours,
    budgetAmount: project.budgetAmount,
    progress: project.progress,
    settings: parseProjectSettings(project.settings),
    customFields: parseCustomFieldValues(project.customFields),
    client: project.client,
    contract: project.contract,
    manager: project.manager,
    members: project.members.map((m) => ({ userId: m.userId, role: m.role, allocationPercent: m.allocationPercent, name: m.user.name, image: m.user.image })),
    stages: project.stages,
    phases: project.phases,
    loggedHours,
    ...stats,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export type ProjectRow = ReturnType<typeof decorate>;

const HEALTH_ORDER: Record<ProjectHealth, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

function sortValue(row: ProjectRow, field: string, defsById: Map<string, CustomFieldDef>): string | number | null {
  if (field.startsWith(CUSTOM_FIELD_PARAM_PREFIX)) {
    const def = defsById.get(field.slice(CUSTOM_FIELD_PARAM_PREFIX.length));
    if (!def) return null;
    const key = customFieldSortKey(def, row.customFields[def.id]);
    return key === "" ? null : key;
  }
  switch (field) {
    case "status":
      return PROJECT_STATUSES.indexOf(row.status);
    case "priority":
      return PRIORITIES.indexOf(row.priority);
    case "health":
      return row.health ? HEALTH_ORDER[row.health] : null;
    case "clientName":
      return row.client?.name.toLocaleLowerCase("pt-BR") ?? null;
    case "managerName":
      return row.manager?.name.toLocaleLowerCase("pt-BR") ?? null;
    case "code":
    case "name":
      return row[field].toLocaleLowerCase("pt-BR");
    case "plannedStartDate":
    case "plannedEndDate":
    case "createdAt":
    case "updatedAt": {
      const value = row[field];
      return value ? new Date(value).getTime() : null;
    }
    case "progress":
    case "loggedHours":
    case "overdueCount":
    case "budgetHours": {
      const value = row[field];
      return value ?? null;
    }
    default:
      return null;
  }
}

/** Nulls always last, whatever the direction. */
function compareRows(a: ProjectRow, b: ProjectRow, field: string, direction: "asc" | "desc", defsById: Map<string, CustomFieldDef>) {
  const va = sortValue(a, field, defsById);
  const vb = sortValue(b, field, defsById);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
  return direction === "asc" ? cmp : -cmp;
}

/** Applies status-driven actual dates: start when work begins, end when completed; reopening clears the end. */
export function applyLifecycleDates(
  prevStatus: ProjectStatus | null,
  nextStatus: ProjectStatus,
  dates: { actualStartDate: Date | null; actualEndDate: Date | null },
  today: Date,
) {
  let { actualStartDate, actualEndDate } = dates;
  if (["IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(nextStatus) && !actualStartDate) actualStartDate = today;
  if (nextStatus === "COMPLETED" && !actualEndDate) actualEndDate = today;
  if (prevStatus === "COMPLETED" && nextStatus !== "COMPLETED" && nextStatus !== "CANCELLED") actualEndDate = null;
  return { actualStartDate, actualEndDate };
}

async function nextCode(tx: Tx, organizationId: string): Promise<string> {
  const rows = await tx.project.findMany({ where: { organizationId, code: { startsWith: "PRJ-" } }, select: { code: true } });
  const max = rows.reduce((m, r) => {
    const n = Number(r.code.slice(4));
    return Number.isInteger(n) && n > m ? n : m;
  }, 0);
  return `PRJ-${String(max + 1).padStart(4, "0")}`;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Child rows a project delete takes along (soft-deleted with the same timestamp). */
const PROJECT_OWNED_MODELS = ["ProjectMember", "ProjectTask", "ProjectRisk", "ProjectStage", "ProjectPhase"];

/**
 * Applies the edited workflow: updates/creates stages in the submitted order and removes the
 * missing ones (blocked while tasks use them). Changing a stage's category re-syncs its tasks'
 * status (and completion stamp), since ProjectTask.status mirrors the stage category.
 */
async function syncStages(tx: Tx, projectId: string, stages: ProjectInput["stages"]) {
  const existing = await tx.projectStage.findMany({ where: { projectId, deletedAt: null } });
  const keep = new Set(stages.map((s) => s.id).filter(Boolean));
  for (const stage of existing.filter((s) => !keep.has(s.id))) {
    const inUse = await tx.projectTask.count({ where: { stageId: stage.id, deletedAt: null } });
    if (inUse > 0) throw new Error(`Não é possível remover a etapa “${stage.name}”: mova as ${inUse} tarefa(s) dela antes.`);
    await tx.projectStage.update({ where: { id: stage.id }, data: { deletedAt: new Date() } });
  }
  const now = new Date();
  for (const [i, stage] of stages.entries()) {
    const data = { name: stage.name, color: stage.color, category: stage.category, wipLimit: stage.wipLimit, position: (i + 1) * POSITION_STEP };
    const current = stage.id ? existing.find((s) => s.id === stage.id) : undefined;
    if (!current) {
      await tx.projectStage.create({ data: { ...data, projectId } });
      continue;
    }
    await tx.projectStage.update({ where: { id: current.id }, data });
    if (current.category !== stage.category) {
      await tx.projectTask.updateMany({
        where: { stageId: current.id, deletedAt: null },
        data: { status: stage.category, ...(stage.category === "DONE" ? { progress: 100 } : {}) },
      });
      if (stage.category === "DONE") {
        await tx.projectTask.updateMany({ where: { stageId: current.id, deletedAt: null, completedAt: null }, data: { completedAt: now } });
      } else if (current.category === "DONE") {
        await tx.projectTask.updateMany({ where: { stageId: current.id, deletedAt: null }, data: { completedAt: null } });
      }
    }
  }
  await projectService.recomputeProgress(tx, projectId);
}

/** Same diff for macro phases; removing a phase with tasks is blocked. */
async function syncPhases(tx: Tx, projectId: string, phases: ProjectInput["phases"]) {
  const existing = await tx.projectPhase.findMany({ where: { projectId, deletedAt: null } });
  const keep = new Set(phases.map((p) => p.id).filter(Boolean));
  for (const phase of existing.filter((p) => !keep.has(p.id))) {
    const inUse = await tx.projectTask.count({ where: { phaseId: phase.id, deletedAt: null } });
    if (inUse > 0) throw new Error(`Não é possível remover a fase “${phase.name}”: ela tem ${inUse} tarefa(s). Mova-as para outra fase antes.`);
    await tx.projectPhase.update({ where: { id: phase.id }, data: { deletedAt: new Date() } });
  }
  for (const [i, phase] of phases.entries()) {
    const data = {
      name: phase.name,
      color: phase.color,
      description: phase.description || null,
      startDate: toDateOrNull(phase.startDate),
      endDate: toDateOrNull(phase.endDate),
      position: (i + 1) * POSITION_STEP,
    };
    const current = phase.id ? existing.find((p) => p.id === phase.id) : undefined;
    if (current) await tx.projectPhase.update({ where: { id: current.id }, data });
    else await tx.projectPhase.create({ data: { ...data, projectId } });
  }
}

export const projectService = {
  async list(
    params: ListParams & { filters?: Record<string, string | undefined> },
    ctx: ProjectCtx,
    defs: CustomFieldDef[],
  ): Promise<{ data: ProjectRow[]; meta: PaginationMeta }> {
    const filters = params.filters ?? {};
    const today = getTodayDateOnly();
    const baseWhere = await projectRepository.buildWhere(
      { search: params.search, filters: { status: filters.status, priority: filters.priority, clientId: filters.clientId, managerId: filters.managerId } },
      ctx.organizationId,
    );
    const and: Prisma.ProjectWhereInput[] = [projectScopeWhere(ctx.allowedClientIds)];
    if (filters.mine === "true") {
      and.push({ OR: [{ managerId: ctx.userId }, { members: { some: { userId: ctx.userId } } }] });
    }
    and.push(...(buildCustomFieldWhere(defs, filters) as Prisma.ProjectWhereInput[]));

    const projects = await prisma.project.findMany({
      where: { ...(baseWhere as Prisma.ProjectWhereInput), AND: and },
      include: projectInclude,
      take: 2000,
    });
    const stats = await loadTaskStats(projects.map((p) => p.id), today);
    let rows = projects.map((p) => decorate(p, stats.get(p.id) ?? EMPTY_STATS, today));
    if (filters.health) rows = rows.filter((r) => r.health === filters.health);

    const defsById = new Map(defs.map((d) => [d.id, d]));
    const sort = params.sort ?? { field: "updatedAt", direction: "desc" as const };
    rows.sort((a, b) => compareRows(a, b, sort.field, sort.direction, defsById));

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    return {
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length, totalPages: Math.ceil(rows.length / pageSize) },
    };
  },

  async getById(id: string, ctx: Pick<ProjectCtx, "organizationId" | "allowedClientIds">) {
    const project = await prisma.project.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null, ...projectScopeWhere(ctx.allowedClientIds) },
      include: projectInclude,
    });
    if (!project) return null;
    const today = getTodayDateOnly();
    const stats = await loadTaskStats([id], today);
    return decorate(project, stats.get(id) ?? EMPTY_STATS, today);
  },

  /** Throws when the project is missing or outside the caller's client scope. */
  async assertAccessible(id: string, ctx: Pick<ProjectCtx, "organizationId" | "allowedClientIds">, tx: Tx | typeof prisma = prisma) {
    const project = await tx.project.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null, ...projectScopeWhere(ctx.allowedClientIds) },
    });
    if (!project) throw new Error("Projeto não encontrado ou fora do seu escopo de acesso");
    return project;
  },

  /** Clients, contracts and users for the project form (scoped to the caller's clients). */
  async listPickerOptions(ctx: Pick<ProjectCtx, "organizationId" | "allowedClientIds">) {
    const [clients, contracts, users] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId: ctx.organizationId, deletedAt: null, id: { in: ctx.allowedClientIds } },
        select: { id: true, name: true, color: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.clientContract.findMany({
        where: { clientId: { in: ctx.allowedClientIds }, client: { organizationId: ctx.organizationId, deletedAt: null } },
        select: { id: true, clientId: true, contractedHours: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: "desc" },
      }),
      prisma.user.findMany({
        where: { organizationId: ctx.organizationId, deletedAt: null, status: true },
        select: { id: true, name: true, image: true, allowedClients: { select: { clientId: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      clients,
      contracts,
      users: users.map((u) => ({ id: u.id, name: u.name, image: u.image, clientIds: u.allowedClients.map((c) => c.clientId) })),
    };
  },

  /** Validates client/contract/manager/members against tenancy and client access. */
  async assertLinks(input: ProjectInput, ctx: ProjectCtx) {
    const clientId = input.clientId || null;
    const contractId = input.contractId || null;
    const managerId = input.managerId || null;
    const memberIds = [...new Set([...(input.memberIds ?? []), ...(managerId ? [managerId] : [])])];

    if (clientId) {
      assertClientAllowed(clientId, ctx.allowedClientIds);
      const client = await prisma.client.findFirst({ where: { id: clientId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!client) throw new Error("Cliente não encontrado");
    }
    if (contractId) {
      const contract = await prisma.clientContract.findFirst({ where: { id: contractId, clientId: clientId ?? undefined } });
      if (!contract || !clientId) throw new Error("O contrato selecionado não pertence ao cliente do projeto");
    }
    if (memberIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: memberIds }, organizationId: ctx.organizationId, deletedAt: null, status: true },
        select: { id: true, name: true, allowedClients: clientId ? { where: { clientId }, select: { clientId: true } } : false },
      });
      if (users.length !== memberIds.length) throw new Error("Gerente ou membro inválido (usuário inativo ou de outra organização)");
      if (clientId) {
        const withoutAccess = users.filter((u) => !u.allowedClients?.length).map((u) => u.name);
        if (withoutAccess.length) {
          throw new Error(`Sem acesso ao cliente do projeto: ${withoutAccess.join(", ")}. Libere o cliente no cadastro do usuário.`);
        }
      }
    }
    return { clientId, contractId, managerId, memberIds };
  },

  async create(input: ProjectInput, ctx: ProjectCtx) {
    const links = await this.assertLinks(input, ctx);
    const customFields = await customFieldService.validateValues(ctx.organizationId, "PROJECT", input.customFields);
    const today = getTodayDateOnly();
    const dates = applyLifecycleDates(
      null,
      input.status,
      { actualStartDate: toDateOrNull(input.actualStartDate), actualEndDate: toDateOrNull(input.actualEndDate) },
      today,
    );

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const code = input.code || (await nextCode(tx, ctx.organizationId));
          return tx.project.create({
            data: {
              organizationId: ctx.organizationId,
              code,
              name: input.name,
              description: input.description || null,
              objective: input.objective || null,
              scope: input.scope || null,
              outOfScope: input.outOfScope || null,
              assumptions: input.assumptions || null,
              successCriteria: input.successCriteria || null,
              clientId: links.clientId,
              contractId: links.contractId,
              managerId: links.managerId,
              sponsorName: input.sponsorName || null,
              status: input.status,
              health: input.health,
              priority: input.priority,
              plannedStartDate: toDateOrNull(input.plannedStartDate),
              plannedEndDate: toDateOrNull(input.plannedEndDate),
              ...dates,
              budgetHours: input.budgetHours,
              budgetAmount: input.budgetAmount,
              color: input.color,
              settings: input.settings as Prisma.InputJsonValue,
              customFields: customFields as Prisma.InputJsonValue,
              members: { create: links.memberIds.map((userId) => ({ userId })) },
              stages: {
                create: (input.stages.length ? input.stages : DEFAULT_STAGES).map((st, i) => ({
                  name: st.name,
                  color: st.color,
                  category: st.category,
                  wipLimit: st.wipLimit,
                  position: (i + 1) * POSITION_STEP,
                })),
              },
              phases: {
                create: input.phases.map((ph, i) => ({
                  name: ph.name,
                  color: ph.color,
                  description: ph.description || null,
                  startDate: toDateOrNull(ph.startDate),
                  endDate: toDateOrNull(ph.endDate),
                  position: (i + 1) * POSITION_STEP,
                })),
              },
            },
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          if (input.code) throw new Error(`Código "${input.code}" já utilizado por outro projeto`);
          continue; // concurrent auto code — retry with the next number
        }
        throw error;
      }
    }
    throw new Error("Não foi possível gerar o código do projeto. Tente novamente.");
  },

  async update(id: string, input: ProjectInput, ctx: ProjectCtx): Promise<{ project: Project; old: Project }> {
    const old = await this.assertAccessible(id, ctx);
    const links = await this.assertLinks(input, ctx);
    if (old.clientId !== links.clientId) {
      const demands = await prisma.demand.count({ where: { projectId: id, deletedAt: null } });
      if (demands > 0) {
        throw new Error(`Não é possível trocar o cliente: o projeto já tem ${demands} demanda(s) lançada(s) para o cliente atual.`);
      }
    }
    const customFields = await customFieldService.validateValues(ctx.organizationId, "PROJECT", input.customFields, old.customFields);
    const dates = applyLifecycleDates(
      old.status,
      input.status,
      { actualStartDate: toDateOrNull(input.actualStartDate), actualEndDate: toDateOrNull(input.actualEndDate) },
      getTodayDateOnly(),
    );

    try {
      const project = await prisma.$transaction(async (tx) => {
        await tx.projectMember.deleteMany({ where: { projectId: id, userId: { notIn: links.memberIds } } });
        if (links.memberIds.length) {
          await tx.projectMember.createMany({ data: links.memberIds.map((userId) => ({ projectId: id, userId })), skipDuplicates: true });
        }
        await syncStages(tx, id, input.stages);
        await syncPhases(tx, id, input.phases);
        return tx.project.update({
          where: { id },
          data: {
            code: input.code || old.code,
            name: input.name,
            description: input.description || null,
            objective: input.objective || null,
            scope: input.scope || null,
            outOfScope: input.outOfScope || null,
            assumptions: input.assumptions || null,
            successCriteria: input.successCriteria || null,
            clientId: links.clientId,
            contractId: links.contractId,
            managerId: links.managerId,
            sponsorName: input.sponsorName || null,
            status: input.status,
            health: input.health,
            priority: input.priority,
            plannedStartDate: toDateOrNull(input.plannedStartDate),
            plannedEndDate: toDateOrNull(input.plannedEndDate),
            ...dates,
            budgetHours: input.budgetHours,
            budgetAmount: input.budgetAmount,
            color: input.color,
            settings: input.settings as Prisma.InputJsonValue,
            customFields: customFields as Prisma.InputJsonValue,
          },
        });
      });

      return { project, old };
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error(`Código "${input.code}" já utilizado por outro projeto`);
      throw error;
    }
  },

  async setLifecycleStatus(id: string, status: ProjectStatus, ctx: ProjectCtx) {
    const old = await this.assertAccessible(id, ctx);
    const dates = applyLifecycleDates(old.status, status, { actualStartDate: old.actualStartDate, actualEndDate: old.actualEndDate }, getTodayDateOnly());
    const project = await prisma.project.update({ where: { id }, data: { status, ...dates } });
    return { project, old };
  },

  /**
   * Soft-deletes the project with its tasks and risks (same timestamp, so restore brings back
   * exactly those). Blocked while hours were logged — they already consumed the client contract.
   */
  async softDelete(id: string, ctx: ProjectCtx) {
    const project = await this.assertAccessible(id, ctx);
    const reasons = await findBlockingReferences("Project", id, { ignoreModels: PROJECT_OWNED_MODELS });
    if (reasons.length > 0) {
      throw new Error(`Não é possível excluir: registro em uso em ${formatBlockingReferences(reasons)}.`);
    }
    const now = new Date();
    await prisma.$transaction([
      prisma.projectTask.updateMany({ where: { projectId: id, deletedAt: null }, data: { deletedAt: now } }),
      prisma.projectRisk.updateMany({ where: { projectId: id, deletedAt: null }, data: { deletedAt: now } }),
      prisma.projectStage.updateMany({ where: { projectId: id, deletedAt: null }, data: { deletedAt: now } }),
      prisma.projectPhase.updateMany({ where: { projectId: id, deletedAt: null }, data: { deletedAt: now } }),
      prisma.project.update({ where: { id }, data: { deletedAt: now } }),
    ]);
    return project;
  },

  async restore(id: string, ctx: ProjectCtx) {
    const project = await prisma.project.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: { not: null }, ...projectScopeWhere(ctx.allowedClientIds) },
    });
    if (!project) throw new Error("Projeto não encontrado ou fora do seu escopo de acesso");
    await prisma.$transaction([
      prisma.projectTask.updateMany({ where: { projectId: id, deletedAt: project.deletedAt }, data: { deletedAt: null } }),
      prisma.projectRisk.updateMany({ where: { projectId: id, deletedAt: project.deletedAt }, data: { deletedAt: null } }),
      prisma.projectStage.updateMany({ where: { projectId: id, deletedAt: project.deletedAt }, data: { deletedAt: null } }),
      prisma.projectPhase.updateMany({ where: { projectId: id, deletedAt: project.deletedAt }, data: { deletedAt: null } }),
      prisma.project.update({ where: { id }, data: { deletedAt: null } }),
    ]);
    return project;
  },

  async bulkSoftDelete(ids: string[], ctx: ProjectCtx) {
    const blocked: { id: string; reasons: Awaited<ReturnType<typeof findBlockingReferences>> }[] = [];
    const deletedIds: string[] = [];
    for (const id of ids) {
      const reasons = await findBlockingReferences("Project", id, { ignoreModels: PROJECT_OWNED_MODELS });
      if (reasons.length > 0) {
        blocked.push({ id, reasons });
        continue;
      }
      try {
        await this.softDelete(id, ctx);
        deletedIds.push(id);
      } catch {
        // out of scope / already deleted — silently skipped like the other bulk deletes
      }
    }
    return { deletedCount: deletedIds.length, deletedIds, blocked };
  },

  async bulkRestore(ids: string[], ctx: ProjectCtx) {
    let count = 0;
    for (const id of ids) {
      try {
        await this.restore(id, ctx);
        count++;
      } catch {
        // skipped
      }
    }
    return count;
  },

  /** Recomputes the denormalized `Project.progress` from its live tasks. */
  async recomputeProgress(tx: Tx, projectId: string) {
    const tasks = await tx.projectTask.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, parentId: true, status: true, progress: true, estimateHours: true, isMilestone: true },
    });
    const progress = computeProjectProgress(tasks);
    await tx.project.update({ where: { id: projectId }, data: { progress } });
    return progress;
  },

  // ── Risks ──────────────────────────────────────────────────────────────────

  async listRisks(projectId: string) {
    return prisma.projectRisk.findMany({
      where: { projectId, deletedAt: null },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  },

  async saveRisk(projectId: string, riskId: string | null, input: ProjectRiskInput, ctx: ProjectCtx) {
    await this.assertAccessible(projectId, ctx);
    if (input.ownerId) {
      const owner = await prisma.user.findFirst({ where: { id: input.ownerId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!owner) throw new Error("Responsável inválido");
    }
    const data = {
      title: input.title,
      description: input.description || null,
      probability: input.probability,
      impact: input.impact,
      status: input.status,
      ownerId: input.ownerId || null,
      mitigationPlan: input.mitigationPlan || null,
      dueDate: toDateOrNull(input.dueDate),
    };
    if (riskId) {
      const existing = await prisma.projectRisk.findFirst({ where: { id: riskId, projectId, deletedAt: null } });
      if (!existing) throw new Error("Risco não encontrado");
      return prisma.projectRisk.update({ where: { id: riskId }, data });
    }
    return prisma.projectRisk.create({ data: { ...data, projectId } });
  },

  async deleteRisk(projectId: string, riskId: string, ctx: ProjectCtx) {
    await this.assertAccessible(projectId, ctx);
    const existing = await prisma.projectRisk.findFirst({ where: { id: riskId, projectId, deletedAt: null } });
    if (!existing) throw new Error("Risco não encontrado");
    return prisma.projectRisk.update({ where: { id: riskId }, data: { deletedAt: new Date() } });
  },
};
