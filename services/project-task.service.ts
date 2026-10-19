import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { findBlockingReferences, formatBlockingReferences } from "@/lib/entity-relations";
import { getTodayDateOnly } from "@/lib/export-period";
import { buildCustomFieldWhere, parseCustomFieldValues, type CustomFieldDef } from "@/lib/custom-fields";
import {
  descendantIds,
  insertAfter,
  needsRebalance,
  positionBetween,
  POSITION_STEP,
  rebalance,
  soleAssigneeId,
  statusSideEffects,
  wouldCreateCycle,
} from "@/lib/project-tasks";
import { CLOSED_TASK_STATUSES, parseProjectSettings, type TaskStatus } from "@/lib/projects";
import type { TaskFilters } from "@/lib/project-workspace-params";
import { buildProjectTaskAssignedNotification } from "@/lib/notification-types";
import { customFieldService } from "@/services/custom-field.service";
import { notificationService } from "@/services/notification.service";
import { projectService, type ProjectCtx } from "@/services/project.service";
import { logger } from "@/lib/logger";
import type {
  DependencyInput,
  MoveTaskInput,
  ProjectTaskInput,
  ProjectTaskPatch,
  QuickTaskInput,
  RescheduleTaskInput,
} from "@/schemas/project-task.schema";

type Tx = Prisma.TransactionClient;

const toDateOrNull = (value?: string | null) => (value ? new Date(value) : null);

/** Child rows a task delete cleans up itself — they never block it. */
const TASK_OWNED_MODELS = ["ProjectTaskDependency", "ProjectTaskComment", "ProjectTaskChecklistItem", "ProjectTaskTag", "ProjectTaskDueAlert"];

export const taskListSelect = {
  id: true,
  projectId: true,
  parentId: true,
  stageId: true,
  phaseId: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  assigneeId: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  estimateHours: true,
  loggedMinutes: true,
  progress: true,
  isMilestone: true,
  boardPosition: true,
  outlinePosition: true,
  customFields: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, image: true } },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
  predecessors: { select: { id: true, predecessorId: true, lagDays: true } },
  _count: { select: { children: { where: { deletedAt: null } }, comments: { where: { deletedAt: null } }, checklistItems: true } },
  checklistItems: { select: { done: true } },
} satisfies Prisma.ProjectTaskSelect;

type TaskListRow = Prisma.ProjectTaskGetPayload<{ select: typeof taskListSelect }>;

function toTaskDTO(task: TaskListRow) {
  const { tags, checklistItems, _count, customFields, ...rest } = task;
  return {
    ...rest,
    customFields: parseCustomFieldValues(customFields),
    tags: tags.map((t) => t.tag),
    childCount: _count.children,
    commentCount: _count.comments,
    checklistTotal: _count.checklistItems,
    checklistDone: checklistItems.filter((i) => i.done).length,
  };
}

export type ProjectTaskDTO = ReturnType<typeof toTaskDTO>;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Prisma where for the workspace task filters (shared by every view). */
export function buildTaskWhere(projectId: string, filters: TaskFilters, userId: string, defs: CustomFieldDef[]): Prisma.ProjectTaskWhereInput {
  const and: Prisma.ProjectTaskWhereInput[] = [{ projectId, deletedAt: null }];
  const today = getTodayDateOnly();

  if (filters.q) {
    const n = Number(filters.q.replace(/^.*-/, ""));
    and.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
      ],
    });
  }
  if (filters.assignee === "me") and.push({ assigneeId: userId });
  else if (filters.assignee === "none") and.push({ assigneeId: null });
  else if (filters.assignee) and.push({ assigneeId: filters.assignee });

  if (filters.stage.length) and.push({ stageId: { in: filters.stage } });
  else if (!filters.showCancelled) and.push({ status: { not: "CANCELLED" } });
  if (filters.phase === "none") and.push({ phaseId: null });
  else if (filters.phase) and.push({ phaseId: filters.phase });

  if (filters.priority.length) and.push({ priority: { in: filters.priority } });
  if (filters.tag) and.push({ tags: { some: { tagId: filters.tag } } });

  if (filters.due === "overdue") and.push({ dueDate: { lt: today }, status: { notIn: [...CLOSED_TASK_STATUSES] } });
  else if (filters.due === "week") and.push({ dueDate: { gte: today, lt: addDays(today, 7) } });
  else if (filters.due === "none") and.push({ dueDate: null });

  and.push(...(buildCustomFieldWhere(defs, filters.customFields) as Prisma.ProjectTaskWhereInput[]));
  return { AND: and };
}

async function nextNumber(tx: Tx, projectId: string) {
  const last = await tx.projectTask.aggregate({ where: { projectId }, _max: { number: true } });
  return (last._max.number ?? 0) + 1;
}

async function endOfColumn(tx: Tx, projectId: string, stageId: string, excludeId?: string) {
  const last = await tx.projectTask.aggregate({
    where: { projectId, stageId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _max: { boardPosition: true },
  });
  return (last._max.boardPosition ?? 0) + POSITION_STEP;
}

async function endOfSiblings(tx: Tx, projectId: string, parentId: string | null) {
  const last = await tx.projectTask.aggregate({ where: { projectId, parentId, deletedAt: null }, _max: { outlinePosition: true } });
  return (last._max.outlinePosition ?? 0) + POSITION_STEP;
}

/**
 * Resolves the workflow stage of a task: the given one (must belong to the project) or, by default,
 * the first "a fazer" stage (else the first stage). The task status mirrors the stage category.
 */
export async function resolveStage(projectId: string, stageId?: string | null) {
  if (stageId) {
    const stage = await prisma.projectStage.findFirst({ where: { id: stageId, projectId, deletedAt: null } });
    if (!stage) throw new Error("Etapa não encontrada neste projeto");
    return stage;
  }
  const stages = await prisma.projectStage.findMany({ where: { projectId, deletedAt: null }, orderBy: { position: "asc" } });
  const stage = stages.find((s) => s.category === "TODO") ?? stages.find((s) => s.category === "BACKLOG") ?? stages[0];
  if (!stage) throw new Error("Defina as etapas do projeto antes de criar tarefas");
  return stage;
}

async function resolvePhase(projectId: string, phaseId?: string | null) {
  if (!phaseId) return null;
  const phase = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId, deletedAt: null }, select: { id: true } });
  if (!phase) throw new Error("Fase não encontrada neste projeto");
  return phase.id;
}

/**
 * Hours logged on tasks are demands (Demandas) linked to them: keeps the denormalized
 * `ProjectTask.loggedMinutes` equal to the sum of their live demands' duration.
 */
export async function syncTaskLoggedMinutes(taskIds: (string | null | undefined)[]) {
  const ids = [...new Set(taskIds.filter((id): id is string => !!id))];
  if (!ids.length) return;
  const sums = await prisma.demand.groupBy({
    by: ["projectTaskId"],
    where: { projectTaskId: { in: ids }, deletedAt: null },
    _sum: { durationMinutes: true },
  });
  const byTask = new Map(sums.map((s) => [s.projectTaskId, s._sum.durationMinutes ?? 0]));
  await prisma.$transaction(ids.map((id) => prisma.projectTask.update({ where: { id }, data: { loggedMinutes: byTask.get(id) ?? 0 } })));
}

/** WIP limit of a column a task is entering (only when the project opted in via `settings.wipEnforced`). */
async function assertWipRoom(projectId: string, stage: { id: string; name: string; wipLimit: number | null }, projectSettings: unknown) {
  if (!stage.wipLimit || !parseProjectSettings(projectSettings).wipEnforced) return;
  const inColumn = await prisma.projectTask.count({ where: { projectId, stageId: stage.id, deletedAt: null } });
  if (inColumn >= stage.wipLimit) {
    throw new Error(`Limite WIP de "${stage.name}" atingido (${stage.wipLimit}). Conclua ou mova outra tarefa antes.`);
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const projectTaskService = {
  async list(projectId: string, filters: TaskFilters, ctx: ProjectCtx, defs: CustomFieldDef[]) {
    await projectService.assertAccessible(projectId, ctx);
    const tasks = await prisma.projectTask.findMany({
      where: buildTaskWhere(projectId, filters, ctx.userId, defs),
      select: taskListSelect,
      // Priority enum is declared LOW..URGENT, so desc = Urgente → Baixa (the order every view shows).
      orderBy: [{ priority: "desc" }, { boardPosition: "asc" }, { number: "asc" }],
      take: 5000,
    });
    return tasks.map(toTaskDTO);
  },

  /** Light lists for pickers (parent task, dependencies, tags) — unfiltered. */
  async listOptions(projectId: string, ctx: ProjectCtx) {
    await projectService.assertAccessible(projectId, ctx);
    const [tasks, tags] = await Promise.all([
      prisma.projectTask.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, number: true, title: true, parentId: true, status: true },
        orderBy: { number: "asc" },
      }),
      prisma.tag.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, name: true, color: true }, orderBy: { name: "asc" } }),
    ]);
    return { tasks, tags };
  },

  async getDetail(taskId: string, projectId: string, ctx: ProjectCtx) {
    await projectService.assertAccessible(projectId, ctx);
    const task = await prisma.projectTask.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      select: {
        ...taskListSelect,
        description: true,
        parent: { select: { id: true, number: true, title: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, number: true, title: true, status: true, priority: true, stage: { select: { name: true, color: true } }, assignee: { select: { name: true } }, dueDate: true },
          orderBy: [{ priority: "desc" }, { outlinePosition: "asc" }, { number: "asc" }],
        },
        predecessors: {
          select: { id: true, predecessorId: true, lagDays: true, predecessor: { select: { id: true, number: true, title: true, status: true, stage: { select: { name: true, color: true } }, dueDate: true } } },
        },
        successors: {
          select: { id: true, successorId: true, lagDays: true, successor: { select: { id: true, number: true, title: true, status: true, stage: { select: { name: true, color: true } }, startDate: true } } },
        },
        checklistItems: { select: { id: true, title: true, done: true, position: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        comments: {
          where: { deletedAt: null },
          select: { id: true, content: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
        demands: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            date: true,
            startTime: true,
            endTime: true,
            durationMinutes: true,
            status: true,
            analyst: { select: { id: true, name: true, userId: true } },
          },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
          take: 200,
        },
      },
    });
    if (!task) return null;
    const { tags, _count, customFields, checklistItems, ...rest } = task;
    return {
      ...rest,
      checklistItems,
      customFields: parseCustomFieldValues(customFields),
      tags: tags.map((t) => t.tag),
      childCount: _count.children,
      commentCount: _count.comments,
    };
  },

  /** Loads a live task of an accessible project (or throws). */
  async loadTask(taskId: string, projectId: string, ctx: ProjectCtx, tx: Tx | typeof prisma = prisma) {
    const project = await projectService.assertAccessible(projectId, ctx, tx);
    const task = await tx.projectTask.findFirst({ where: { id: taskId, projectId, deletedAt: null } });
    if (!task) throw new Error("Tarefa não encontrada");
    return { project, task };
  },

  /** Assignee must be on the project team (member or manager). */
  async assertAssignee(projectId: string, managerId: string | null, assigneeId: string | null | undefined) {
    if (!assigneeId) return;
    if (assigneeId === managerId) return;
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId: assigneeId, user: { deletedAt: null, status: true } },
    });
    if (!member) throw new Error("O responsável precisa fazer parte da equipe do projeto");
  },

  /** The project's only possible assignee (active manager ∪ active members), else null. */
  async defaultAssigneeId(projectId: string, managerId: string | null) {
    const activeUser = { deletedAt: null, status: true };
    const [members, manager] = await Promise.all([
      prisma.projectMember.findMany({ where: { projectId, user: activeUser }, select: { userId: true } }),
      managerId ? prisma.user.findFirst({ where: { id: managerId, ...activeUser }, select: { id: true } }) : null,
    ]);
    return soleAssigneeId(manager?.id ?? null, members.map((m) => m.userId));
  },

  async assertParent(projectId: string, parentId: string | null | undefined, taskId?: string) {
    if (!parentId) return null;
    if (parentId === taskId) throw new Error("Uma tarefa não pode ser subtarefa dela mesma");
    const parent = await prisma.projectTask.findFirst({ where: { id: parentId, projectId, deletedAt: null }, select: { id: true } });
    if (!parent) throw new Error("Tarefa pai não encontrada neste projeto");
    if (taskId) {
      const all = await prisma.projectTask.findMany({ where: { projectId, deletedAt: null }, select: { id: true, parentId: true } });
      if (descendantIds(all, taskId).has(parentId)) throw new Error("A tarefa pai não pode ser uma subtarefa desta tarefa");
    }
    return parentId;
  },

  async assertTags(organizationId: string, tagIds: string[]) {
    if (!tagIds.length) return [];
    const unique = [...new Set(tagIds)];
    const count = await prisma.tag.count({ where: { id: { in: unique }, organizationId } });
    if (count !== unique.length) throw new Error("Tag inválida");
    return unique;
  },

  async notifyAssignee(task: { id: string; number: number; title: string; dueDate: Date | null; assigneeId: string | null }, project: { id: string; code: string; name: string }, ctx: ProjectCtx) {
    if (!task.assigneeId || task.assigneeId === ctx.userId) return;
    try {
      const actor = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
      await notificationService.create({
        organizationId: ctx.organizationId,
        userId: task.assigneeId,
        ...buildProjectTaskAssignedNotification({
          projectId: project.id,
          projectCode: project.code,
          projectName: project.name,
          taskId: task.id,
          taskNumber: task.number,
          taskTitle: task.title,
          assignedBy: actor?.name ?? "Alguém",
          dueDate: task.dueDate,
        }),
      });
    } catch (error) {
      logger.error("Falha ao notificar responsável da tarefa", { taskId: task.id, error: (error as Error).message });
    }
  },

  async create(projectId: string, input: ProjectTaskInput, ctx: ProjectCtx) {
    const project = await projectService.assertAccessible(projectId, ctx);
    const parentId = await this.assertParent(projectId, input.parentId);
    await this.assertAssignee(projectId, project.managerId, input.assigneeId);
    // Key absent (e.g. AI assistant) → sole team member; "" means the user chose "Sem responsável".
    const assigneeId = input.assigneeId === undefined ? await this.defaultAssigneeId(projectId, project.managerId) : input.assigneeId || null;
    const tagIds = await this.assertTags(ctx.organizationId, input.tagIds);
    const customFields = await customFieldService.validateValues(ctx.organizationId, "TASK", input.customFields);
    const stage = await resolveStage(projectId, input.stageId);
    await assertWipRoom(projectId, stage, project.settings);
    const phaseId = await resolvePhase(projectId, input.phaseId);
    const effects = statusSideEffects(null, stage.category, new Date());

    const task = await this.withNumberRetry((tx) =>
      (async () => {
        const created = await tx.projectTask.create({
          data: {
            organizationId: ctx.organizationId,
            projectId,
            parentId,
            number: await nextNumber(tx, projectId),
            title: input.title,
            description: input.description || null,
            stageId: stage.id,
            phaseId,
            status: stage.category,
            priority: input.priority,
            assigneeId,
            startDate: toDateOrNull(input.startDate),
            dueDate: toDateOrNull(input.dueDate),
            estimateHours: input.estimateHours,
            progress: input.progress,
            isMilestone: input.isMilestone,
            boardPosition: await endOfColumn(tx, projectId, stage.id),
            outlinePosition: await endOfSiblings(tx, projectId, parentId),
            customFields: customFields as Prisma.InputJsonValue,
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
            ...effects,
          },
        });
        await projectService.recomputeProgress(tx, projectId);
        return created;
      })(),
    );
    await this.notifyAssignee(task, project, ctx);
    return { task, project };
  },

  /** Inline creation from the kanban/list: title (+ column), required custom fields not enforced. */
  async quickCreate(projectId: string, input: QuickTaskInput, ctx: ProjectCtx) {
    const project = await projectService.assertAccessible(projectId, ctx);
    const parentId = await this.assertParent(projectId, input.parentId);
    const stage = await resolveStage(projectId, input.stageId);
    await assertWipRoom(projectId, stage, project.settings);
    const assigneeId = await this.defaultAssigneeId(projectId, project.managerId);
    const parent = parentId ? await prisma.projectTask.findUnique({ where: { id: parentId }, select: { phaseId: true } }) : null;
    const effects = statusSideEffects(null, stage.category, new Date());
    const task = await this.withNumberRetry((tx) =>
      (async () => {
        const created = await tx.projectTask.create({
          data: {
            organizationId: ctx.organizationId,
            projectId,
            parentId,
            number: await nextNumber(tx, projectId),
            title: input.title,
            stageId: stage.id,
            phaseId: parent?.phaseId ?? null,
            status: stage.category,
            assigneeId,
            dueDate: toDateOrNull(input.dueDate),
            boardPosition: await endOfColumn(tx, projectId, stage.id),
            outlinePosition: await endOfSiblings(tx, projectId, parentId),
            ...effects,
          },
        });
        await projectService.recomputeProgress(tx, projectId);
        return created;
      })(),
    );
    await this.notifyAssignee(task, project, ctx);
    return { task, project };
  },

  /** Per-project task numbers are unique: retry the transaction when two creates race. */
  async withNumberRetry<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await prisma.$transaction((tx) => fn(tx));
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 3) continue;
        throw error;
      }
    }
  },

  /**
   * Full edit. Only what changed is re-validated (a parent/assignee the task already had is kept even
   * if it would no longer be accepted, e.g. the assignee left the team). `fromPatch` = inline edit:
   * required custom fields aren't enforced and a task without a stage keeps having none.
   */
  async update(taskId: string, projectId: string, input: ProjectTaskInput, ctx: ProjectCtx, opts: { fromPatch?: boolean } = {}) {
    const { project, task: old } = await this.loadTask(taskId, projectId, ctx);
    const nextParentId = input.parentId || null;
    const parentId = nextParentId === old.parentId ? old.parentId : await this.assertParent(projectId, nextParentId, taskId);
    if ((input.assigneeId || null) !== old.assigneeId) await this.assertAssignee(projectId, project.managerId, input.assigneeId);
    const tagIds = await this.assertTags(ctx.organizationId, input.tagIds);
    const customFields = await customFieldService.validateValues(ctx.organizationId, "TASK", input.customFields, old.customFields, {
      partial: opts.fromPatch,
    });
    const stage = old.stageId || !opts.fromPatch ? await resolveStage(projectId, input.stageId) : null;
    if (stage && old.stageId !== stage.id) await assertWipRoom(projectId, stage, project.settings);
    const phaseId = await resolvePhase(projectId, input.phaseId);
    const stageData = stage ? { stageId: stage.id, status: stage.category, ...statusSideEffects(old.status, stage.category, new Date()) } : {};

    const task = await prisma.$transaction(async (tx) => {
      await tx.projectTaskTag.deleteMany({ where: { taskId, tagId: { notIn: tagIds } } });
      if (tagIds.length) await tx.projectTaskTag.createMany({ data: tagIds.map((tagId) => ({ taskId, tagId })), skipDuplicates: true });
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: {
          parentId,
          title: input.title,
          description: input.description || null,
          phaseId,
          priority: input.priority,
          assigneeId: input.assigneeId || null,
          startDate: toDateOrNull(input.startDate),
          dueDate: toDateOrNull(input.dueDate),
          estimateHours: input.estimateHours,
          progress: input.progress,
          isMilestone: input.isMilestone,
          customFields: customFields as Prisma.InputJsonValue,
          ...(stage && old.stageId !== stage.id ? { boardPosition: await endOfColumn(tx, projectId, stage.id, taskId) } : {}),
          ...(old.parentId !== parentId ? { outlinePosition: await endOfSiblings(tx, projectId, parentId) } : {}),
          ...stageData,
        },
      });
      await projectService.recomputeProgress(tx, projectId);
      return updated;
    });
    if (task.assigneeId !== old.assigneeId) await this.notifyAssignee(task, project, ctx);
    return { task, old, project, warning: await this.predecessorWarning(task.id, old.status, task.status) };
  },

  /** Inline single-property edit: merges the patch with the stored task and reuses `update` (same rules). */
  async patch(taskId: string, projectId: string, patch: ProjectTaskPatch, ctx: ProjectCtx) {
    const old = await prisma.projectTask.findFirst({
      where: { id: taskId, projectId, deletedAt: null },
      include: { tags: { select: { tagId: true } } },
    });
    if (!old) throw new Error("Tarefa não encontrada");
    const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");
    const merge = <T>(next: T | null | undefined, current: T | null) => (next === undefined ? current : next);
    const input: ProjectTaskInput = {
      title: patch.title ?? old.title,
      description: merge(patch.description, old.description) ?? "",
      stageId: old.stageId ?? "",
      phaseId: merge(patch.phaseId, old.phaseId) ?? undefined,
      priority: patch.priority ?? old.priority,
      assigneeId: merge(patch.assigneeId, old.assigneeId) ?? undefined,
      parentId: old.parentId ?? undefined,
      startDate: patch.startDate === undefined ? day(old.startDate) : (patch.startDate ?? ""),
      dueDate: patch.dueDate === undefined ? day(old.dueDate) : (patch.dueDate ?? ""),
      estimateHours: merge(patch.estimateHours, old.estimateHours),
      progress: patch.progress ?? old.progress,
      isMilestone: patch.isMilestone ?? old.isMilestone,
      tagIds: patch.tagIds ?? old.tags.map((t) => t.tagId),
      customFields: parseCustomFieldValues(old.customFields),
    };
    if (input.startDate && input.dueDate && input.dueDate < input.startDate) throw new Error("Prazo deve ser igual ou posterior ao início");
    return this.update(taskId, projectId, input, ctx, { fromPatch: true });
  },

  /** Moving into "Em andamento" while an FS predecessor is still open is allowed, but flagged. */
  async predecessorWarning(taskId: string, prev: TaskStatus, next: TaskStatus): Promise<string | undefined> {
    if (prev === next || next !== "IN_PROGRESS") return undefined;
    const open = await prisma.projectTaskDependency.count({
      where: { successorId: taskId, predecessor: { deletedAt: null, status: { notIn: [...CLOSED_TASK_STATUSES] } } },
    });
    return open > 0 ? `Atenção: ${open} tarefa(s) predecessora(s) ainda não concluída(s).` : undefined;
  },

  /**
   * Kanban drop: new status + position between the neighbour cards (looked up by id, in the target
   * column). Rebalances the column when the fractional gap runs out. Enforces WIP limits when the
   * project opted in (`settings.wipEnforced`).
   */
  async move(taskId: string, projectId: string, input: MoveTaskInput, ctx: ProjectCtx) {
    const { project, task: old } = await this.loadTask(taskId, projectId, ctx);
    const stage = await resolveStage(projectId, input.stageId);
    if (old.stageId !== stage.id) await assertWipRoom(projectId, stage, project.settings);

    const task = await prisma.$transaction(async (tx) => {
      const neighbours = await tx.projectTask.findMany({
        where: { id: { in: [input.beforeId, input.afterId].filter((x): x is string => !!x) }, projectId, stageId: stage.id, deletedAt: null },
        select: { id: true, boardPosition: true },
      });
      const before = neighbours.find((n) => n.id === input.beforeId)?.boardPosition ?? null;
      const after = neighbours.find((n) => n.id === input.afterId)?.boardPosition ?? null;

      let boardPosition: number;
      if (!input.beforeId && !input.afterId) {
        // No neighbours (empty column, or a stage change from the task sheet): end of the column.
        boardPosition = old.stageId === stage.id ? old.boardPosition : await endOfColumn(tx, projectId, stage.id, taskId);
      } else if (needsRebalance(before, after)) {
        const column = await tx.projectTask.findMany({
          where: { projectId, stageId: stage.id, deletedAt: null },
          select: { id: true },
          orderBy: [{ boardPosition: "asc" }, { number: "asc" }],
        });
        const positions = rebalance(insertAfter(column.map((c) => c.id), taskId, input.beforeId));
        for (const [id, position] of positions) {
          if (id !== taskId) await tx.projectTask.update({ where: { id }, data: { boardPosition: position } });
        }
        boardPosition = positions.get(taskId)!;
      } else {
        boardPosition = positionBetween(before, after);
      }

      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: { stageId: stage.id, status: stage.category, boardPosition, ...statusSideEffects(old.status, stage.category, new Date()) },
      });
      if (old.status !== stage.category) await projectService.recomputeProgress(tx, projectId);
      return updated;
    });
    return { task, old, stage, warning: await this.predecessorWarning(taskId, old.status, task.status) };
  },

  /** Tasks of a project for the demand form's "Tarefa" picker (any accessible project with a client). */
  async listForDemand(projectId: string, ctx: ProjectCtx) {
    await projectService.assertAccessible(projectId, ctx);
    return prisma.projectTask.findMany({
      where: { projectId, deletedAt: null, status: { not: "CANCELLED" } },
      select: { id: true, number: true, title: true },
      orderBy: { number: "asc" },
    });
  },

  async reschedule(taskId: string, projectId: string, input: RescheduleTaskInput, ctx: ProjectCtx) {
    const { task: old } = await this.loadTask(taskId, projectId, ctx);
    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(input.startDate !== undefined ? { startDate: toDateOrNull(input.startDate) } : {}),
        ...(input.dueDate !== undefined ? { dueDate: toDateOrNull(input.dueDate) } : {}),
      },
    });
    if (task.startDate && task.dueDate && task.dueDate < task.startDate) {
      await prisma.projectTask.update({ where: { id: taskId }, data: { startDate: old.startDate, dueDate: old.dueDate } });
      throw new Error("Prazo deve ser igual ou posterior ao início");
    }
    return { task, old };
  },

  /**
   * Blocked by live subtasks and logged hours (they consumed the contract); dependencies,
   * checklist, comments, tags and due alerts go with the task.
   */
  async softDelete(taskId: string, projectId: string, ctx: ProjectCtx) {
    const { task } = await this.loadTask(taskId, projectId, ctx);
    const reasons = await findBlockingReferences("ProjectTask", taskId, { ignoreModels: TASK_OWNED_MODELS });
    if (reasons.length > 0) {
      throw new Error(`Não é possível excluir: registro em uso em ${formatBlockingReferences(reasons)}.`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.projectTaskDependency.deleteMany({ where: { OR: [{ predecessorId: taskId }, { successorId: taskId }] } });
      await tx.projectTaskDueAlert.deleteMany({ where: { taskId } });
      await tx.projectTask.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
      await projectService.recomputeProgress(tx, projectId);
    });
    return task;
  },

  async bulkSoftDelete(ids: string[], projectId: string, ctx: ProjectCtx) {
    await projectService.assertAccessible(projectId, ctx);
    const blocked: { id: string; reasons: Awaited<ReturnType<typeof findBlockingReferences>> }[] = [];
    const deletedIds: string[] = [];
    // Children first, so deleting a parent together with its subtasks isn't blocked by them.
    const tasks = await prisma.projectTask.findMany({ where: { id: { in: ids }, projectId, deletedAt: null }, select: { id: true, parentId: true } });
    const depth = (id: string): number => {
      const parent = tasks.find((t) => t.id === id)?.parentId;
      return parent && tasks.some((t) => t.id === parent) ? 1 + depth(parent) : 0;
    };
    for (const { id } of [...tasks].sort((a, b) => depth(b.id) - depth(a.id))) {
      const reasons = await findBlockingReferences("ProjectTask", id, { ignoreModels: TASK_OWNED_MODELS });
      if (reasons.length) {
        blocked.push({ id, reasons });
        continue;
      }
      await this.softDelete(id, projectId, ctx);
      deletedIds.push(id);
    }
    return { deletedCount: deletedIds.length, deletedIds, blocked };
  },

  // ── Dependencies ───────────────────────────────────────────────────────────

  async addDependency(projectId: string, input: DependencyInput, ctx: ProjectCtx) {
    await projectService.assertAccessible(projectId, ctx);
    const tasks = await prisma.projectTask.count({
      where: { id: { in: [input.predecessorId, input.successorId] }, projectId, deletedAt: null },
    });
    if (tasks !== 2 || input.predecessorId === input.successorId) throw new Error("Selecione duas tarefas diferentes do mesmo projeto");
    const edges = await prisma.projectTaskDependency.findMany({
      where: { predecessor: { projectId, deletedAt: null } },
      select: { predecessorId: true, successorId: true },
    });
    if (wouldCreateCycle(edges.map((e) => [e.predecessorId, e.successorId]), [input.predecessorId, input.successorId])) {
      throw new Error("Esta dependência criaria um ciclo entre as tarefas");
    }
    try {
      return await prisma.projectTaskDependency.create({ data: input });
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error("Dependência já existe");
      throw error;
    }
  },

  async removeDependency(projectId: string, dependencyId: string, ctx: ProjectCtx) {
    await projectService.assertAccessible(projectId, ctx);
    const dependency = await prisma.projectTaskDependency.findFirst({ where: { id: dependencyId, predecessor: { projectId } } });
    if (!dependency) throw new Error("Dependência não encontrada");
    await prisma.projectTaskDependency.delete({ where: { id: dependencyId } });
    return dependency;
  },

  // ── Checklist ──────────────────────────────────────────────────────────────

  async addChecklistItem(taskId: string, projectId: string, title: string, ctx: ProjectCtx) {
    await this.loadTask(taskId, projectId, ctx);
    const last = await prisma.projectTaskChecklistItem.aggregate({ where: { taskId }, _max: { position: true } });
    return prisma.projectTaskChecklistItem.create({ data: { taskId, title, position: (last._max.position ?? 0) + POSITION_STEP } });
  },

  async updateChecklistItem(itemId: string, projectId: string, data: { done?: boolean; title?: string }, ctx: ProjectCtx) {
    const item = await prisma.projectTaskChecklistItem.findFirst({ where: { id: itemId, task: { projectId, deletedAt: null } } });
    if (!item) throw new Error("Item não encontrado");
    await this.loadTask(item.taskId, projectId, ctx);
    return prisma.projectTaskChecklistItem.update({ where: { id: itemId }, data });
  },

  async deleteChecklistItem(itemId: string, projectId: string, ctx: ProjectCtx) {
    const item = await prisma.projectTaskChecklistItem.findFirst({ where: { id: itemId, task: { projectId, deletedAt: null } } });
    if (!item) throw new Error("Item não encontrado");
    await this.loadTask(item.taskId, projectId, ctx);
    await prisma.projectTaskChecklistItem.delete({ where: { id: itemId } });
    return item;
  },

  // ── Comments ───────────────────────────────────────────────────────────────

  async addComment(taskId: string, projectId: string, content: string, ctx: ProjectCtx) {
    await this.loadTask(taskId, projectId, ctx);
    return prisma.projectTaskComment.create({ data: { taskId, userId: ctx.userId, content } });
  },

  /** Authors delete their own comments; moderators (project_tasks:delete) any comment. */
  async deleteComment(commentId: string, projectId: string, ctx: ProjectCtx, canModerate: boolean) {
    const comment = await prisma.projectTaskComment.findFirst({ where: { id: commentId, deletedAt: null, task: { projectId } } });
    if (!comment) throw new Error("Comentário não encontrado");
    await this.loadTask(comment.taskId, projectId, ctx);
    if (comment.userId !== ctx.userId && !canModerate) throw new Error("Você só pode excluir os seus comentários");
    await prisma.projectTaskComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return comment;
  },
};
