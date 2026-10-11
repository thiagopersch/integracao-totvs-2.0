import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { projectService, type ProjectCtx } from "@/services/project.service";
import type { UsageCheckItem } from "@/services/contract-usage.service";
import type { TimeEntryInput } from "@/schemas/project-task.schema";

type Tx = Prisma.TransactionClient;

/** Keeps the denormalized `ProjectTask.loggedMinutes` equal to the sum of its live entries. */
async function syncLoggedMinutes(tx: Tx, taskId: string) {
  const sum = await tx.projectTimeEntry.aggregate({ where: { taskId, deletedAt: null }, _sum: { minutes: true } });
  await tx.projectTask.update({ where: { id: taskId }, data: { loggedMinutes: sum._sum.minutes ?? 0 } });
}

/** Contract-usage checks for the months touched — only when the project consumes a contract. */
function usageItems(project: { clientId: string | null; contractId: string | null }, dates: Date[]): UsageCheckItem[] {
  if (!project.clientId || !project.contractId) return [];
  return dates.map((date) => ({ clientId: project.clientId!, date, trigger: "time_entry" as const }));
}

export const projectTimeEntryService = {
  async listForProject(projectId: string, ctx: ProjectCtx, range?: { gte: Date; lt: Date }) {
    await projectService.assertAccessible(projectId, ctx);
    return prisma.projectTimeEntry.findMany({
      where: { projectId, deletedAt: null, task: { deletedAt: null }, ...(range ? { date: range } : {}) },
      select: {
        id: true,
        date: true,
        minutes: true,
        note: true,
        userId: true,
        user: { select: { name: true } },
        task: { select: { id: true, number: true, title: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  },

  /**
   * Whose hours may be logged: your own always; someone else's (a team member) only with
   * projects:update (`canManage`).
   */
  async resolveUser(input: TimeEntryInput, projectId: string, managerId: string | null, ctx: ProjectCtx, canManage: boolean) {
    const userId = input.userId || ctx.userId;
    if (userId === ctx.userId) return userId;
    if (!canManage) throw new Error("Você só pode apontar as suas próprias horas");
    if (userId === managerId) return userId;
    const member = await prisma.projectMember.findFirst({ where: { projectId, userId } });
    if (!member) throw new Error("O usuário precisa fazer parte da equipe do projeto");
    return userId;
  },

  async create(projectId: string, input: TimeEntryInput, ctx: ProjectCtx, canManage: boolean) {
    const project = await projectService.assertAccessible(projectId, ctx);
    const task = await prisma.projectTask.findFirst({ where: { id: input.taskId, projectId, deletedAt: null } });
    if (!task) throw new Error("Tarefa não encontrada");
    const userId = await this.resolveUser(input, projectId, project.managerId, ctx, canManage);
    const date = new Date(input.date);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.projectTimeEntry.create({
        data: { organizationId: ctx.organizationId, projectId, taskId: task.id, userId, date, minutes: input.minutes, note: input.note || null },
      });
      await syncLoggedMinutes(tx, task.id);
      return created;
    });
    return { entry, task, usageItems: usageItems(project, [date]) };
  },

  async update(entryId: string, projectId: string, input: TimeEntryInput, ctx: ProjectCtx, canManage: boolean) {
    const project = await projectService.assertAccessible(projectId, ctx);
    const old = await prisma.projectTimeEntry.findFirst({ where: { id: entryId, projectId, deletedAt: null } });
    if (!old) throw new Error("Apontamento não encontrado");
    if (old.userId !== ctx.userId && !canManage) throw new Error("Você só pode editar os seus próprios apontamentos");
    const task = await prisma.projectTask.findFirst({ where: { id: input.taskId, projectId, deletedAt: null } });
    if (!task) throw new Error("Tarefa não encontrada");
    const userId = await this.resolveUser({ ...input, userId: input.userId || old.userId }, projectId, project.managerId, ctx, canManage);
    const date = new Date(input.date);

    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectTimeEntry.update({
        where: { id: entryId },
        data: { taskId: task.id, userId, date, minutes: input.minutes, note: input.note || null },
      });
      await syncLoggedMinutes(tx, task.id);
      if (old.taskId !== task.id) await syncLoggedMinutes(tx, old.taskId);
      return updated;
    });
    return { entry, old, usageItems: usageItems(project, [old.date, date]) };
  },

  async softDelete(entryId: string, projectId: string, ctx: ProjectCtx, canManage: boolean) {
    const project = await projectService.assertAccessible(projectId, ctx);
    const old = await prisma.projectTimeEntry.findFirst({ where: { id: entryId, projectId, deletedAt: null } });
    if (!old) throw new Error("Apontamento não encontrado");
    if (old.userId !== ctx.userId && !canManage) throw new Error("Você só pode excluir os seus próprios apontamentos");
    await prisma.$transaction(async (tx) => {
      await tx.projectTimeEntry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
      await syncLoggedMinutes(tx, old.taskId);
    });
    return { old, usageItems: usageItems(project, [old.date]) };
  },
};
