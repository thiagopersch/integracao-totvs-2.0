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
  statusSideEffects,
  wouldCreateCycle,
} from "@/lib/project-tasks";
import { CLOSED_TASK_STATUSES, TASK_STATUS_LABELS, parseProjectSettings, type TaskStatus } from "@/lib/projects";
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

  if (filters.status.length) and.push({ status: { in: filters.status } });
  else if (!filters.showCancelled) and.push({ status: { not: "CANCELLED" } });

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

async function endOfColumn(tx: Tx, projectId: string, status: TaskStatus, excludeId?: string) {
  const last = await tx.projectTask.aggregate({
    where: { projectId, status, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _max: { boardPosition: true },
  });
  return (last._max.boardPosition ?? 0) + POSITION_STEP;
}

async function endOfSiblings(tx: Tx, projectId: string, parentId: string | null) {
  const last = await tx.projectTask.aggregate({ where: { projectId, parentId, deletedAt: null }, _max: { outlinePosition: true } });
  return (last._max.outlinePosition ?? 0) + POSITION_STEP;
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
      orderBy: [{ boardPosition: "asc" }, { number: "asc" }],
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
          select: { id: true, number: true, title: true, status: true, assignee: { select: { name: true } }, dueDate: true },
          orderBy: [{ outlinePosition: "asc" }, { number: "asc" }],
        },
        predecessors: {
          select: { id: true, predecessorId: true, lagDays: true, predecessor: { select: { id: true, number: true, title: true, status: true, dueDate: true } } },
        },
        successors: {
          select: { id: true, successorId: true, lagDays: true, successor: { select: { id: true, number: true, title: true, status: true, startDate: true } } },
        },
        checklistItems: { select: { id: true, title: true, done: true, position: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
        comments: {
          where: { deletedAt: null },
          select: { id: true, content: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
        timeEntries: {
          where: { deletedAt: null },
          select: { id: true, date: true, minutes: true, note: true, createdAt: true, user: { select: { id: true, name: true } } },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
    const tagIds = await this.assertTags(ctx.organizationId, input.tagIds);
    const customFields = await customFieldService.validateValues(ctx.organizationId, "TASK", input.customFields);
    const effects = statusSideEffects(null, input.status, new Date());

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
            status: input.status,
            priority: input.priority,
            assigneeId: input.assigneeId || null,
            startDate: toDateOrNull(input.startDate),
            dueDate: toDateOrNull(input.dueDate),
            estimateHours: input.estimateHours,
            progress: input.progress,
            isMilestone: input.isMilestone,
            boardPosition: await endOfColumn(tx, projectId, input.status),
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
    const effects = statusSideEffects(null, input.status, new Date());
    const task = await this.withNumberRetry((tx) =>
      (async () => {
        const created = await tx.projectTask.create({
          data: {
            organizationId: ctx.organizationId,
            projectId,
            parentId,
            number: await nextNumber(tx, projectId),
            title: input.title,
            status: input.status,
            dueDate: toDateOrNull(input.dueDate),
            boardPosition: await endOfColumn(tx, projectId, input.status),
            outlinePosition: await endOfSiblings(tx, projectId, parentId),
            ...effects,
          },
        });
        await projectService.recomputeProgress(tx, projectId);
        return created;
      })(),
    );
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

  async update(taskId: string, projectId: string, input: ProjectTaskInput, ctx: ProjectCtx) {
    const { project, task: old } = await this.loadTask(taskId, projectId, ctx);
    const parentId = await this.assertParent(projectId, input.parentId, taskId);
    await this.assertAssignee(projectId, project.managerId, input.assigneeId);
    const tagIds = await this.assertTags(ctx.organizationId, input.tagIds);
    const customFields = await customFieldService.validateValues(ctx.organizationId, "TASK", input.customFields, old.customFields);
    const effects = statusSideEffects(old.status, input.status, new Date());

    const task = await prisma.$transaction(async (tx) => {
      await tx.projectTaskTag.deleteMany({ where: { taskId, tagId: { notIn: tagIds } } });
      if (tagIds.length) await tx.projectTaskTag.createMany({ data: tagIds.map((tagId) => ({ taskId, tagId })), skipDuplicates: true });
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: {
          parentId,
          title: input.title,
          description: input.description || null,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId || null,
          startDate: toDateOrNull(input.startDate),
          dueDate: toDateOrNull(input.dueDate),
          estimateHours: input.estimateHours,
          progress: input.progress,
          isMilestone: input.isMilestone,
          customFields: customFields as Prisma.InputJsonValue,
          ...(old.status !== input.status ? { boardPosition: await endOfColumn(tx, projectId, input.status, taskId) } : {}),
          ...(old.parentId !== parentId ? { outlinePosition: await endOfSiblings(tx, projectId, parentId) } : {}),
          ...effects,
        },
      });
      await projectService.recomputeProgress(tx, projectId);
      return updated;
    });
    if (task.assigneeId !== old.assigneeId) await this.notifyAssignee(task, project, ctx);
    return { task, old, project, warning: await this.predecessorWarning(task.id, old.status, task.status) };
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
    const settings = parseProjectSettings(project.settings);
    const limit = settings.wipLimits?.[input.status];
    if (old.status !== input.status && limit && settings.wipEnforced) {
      const inColumn = await prisma.projectTask.count({ where: { projectId, status: input.status, deletedAt: null } });
      if (inColumn >= limit) {
        throw new Error(`Limite WIP de "${TASK_STATUS_LABELS[input.status]}" atingido (${limit}). Conclua ou mova outra tarefa antes.`);
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      const neighbours = await tx.projectTask.findMany({
        where: { id: { in: [input.beforeId, input.afterId].filter((x): x is string => !!x) }, projectId, status: input.status, deletedAt: null },
        select: { id: true, boardPosition: true },
      });
      const before = neighbours.find((n) => n.id === input.beforeId)?.boardPosition ?? null;
      const after = neighbours.find((n) => n.id === input.afterId)?.boardPosition ?? null;

      let boardPosition: number;
      if (!input.beforeId && !input.afterId) {
        // No neighbours (empty column, or a status change from the task sheet): end of the column.
        boardPosition = old.status === input.status ? old.boardPosition : await endOfColumn(tx, projectId, input.status, taskId);
      } else if (needsRebalance(before, after)) {
        const column = await tx.projectTask.findMany({
          where: { projectId, status: input.status, deletedAt: null },
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
        data: { status: input.status, boardPosition, ...statusSideEffects(old.status, input.status, new Date()) },
      });
      if (old.status !== input.status) await projectService.recomputeProgress(tx, projectId);
      return updated;
    });
    return { task, old, warning: await this.predecessorWarning(taskId, old.status, task.status) };
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
