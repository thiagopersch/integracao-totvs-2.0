import { prisma } from "@/lib/prisma";
import { getTodayDateOnly } from "@/lib/export-period";
import {
  buildBurnSeries,
  buildWorkload,
  countByStatus,
  expectedProgress,
  isClosedStatus,
  isOverdue,
  toDateKey,
} from "@/lib/project-metrics";
import { projectService, type ProjectCtx } from "@/services/project.service";
import { contractUsageService } from "@/services/contract-usage.service";
import { currentMonth } from "@/lib/contract-usage";

const DAY_MS = 86_400_000;

/** Monday (UTC) of the week containing `date`. */
function weekStart(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY_MS);
}

export const projectDashboardService = {
  /** Everything the "Indicadores" tab needs, computed from live tasks and time entries. */
  async get(projectId: string, ctx: ProjectCtx) {
    const project = await projectService.getById(projectId, ctx);
    if (!project) return null;
    const today = getTodayDateOnly();

    const [tasks, minutesByUser, entries] = await Promise.all([
      prisma.projectTask.findMany({
        where: { projectId, deletedAt: null },
        select: {
          id: true,
          number: true,
          title: true,
          parentId: true,
          status: true,
          progress: true,
          estimateHours: true,
          isMilestone: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
          assigneeId: true,
          loggedMinutes: true,
        },
      }),
      prisma.projectTimeEntry.groupBy({
        by: ["userId"],
        where: { projectId, deletedAt: null, task: { deletedAt: null } },
        _sum: { minutes: true },
      }),
      prisma.projectTimeEntry.findMany({
        where: { projectId, deletedAt: null, task: { deletedAt: null }, date: { gte: new Date(weekStart(today).getTime() - 11 * 7 * DAY_MS) } },
        select: { date: true, minutes: true },
      }),
    ]);

    const userIds = [...new Set([...tasks.map((t) => t.assigneeId), ...minutesByUser.map((m) => m.userId)].filter((id): id is string => !!id))];
    const [users, analysts] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      prisma.analyst.findMany({ where: { userId: { in: userIds }, deletedAt: null }, select: { userId: true, hourlyRate: true } }),
    ]);
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    const rateByUserId = new Map(analysts.map((a) => [a.userId!, a.hourlyRate]));

    // Cost = logged hours × the analyst hourly rate of each user (users without a linked analyst/rate don't count).
    let cost = 0;
    let costCoveredHours = 0;
    for (const row of minutesByUser) {
      const hours = (row._sum.minutes ?? 0) / 60;
      const rate = rateByUserId.get(row.userId);
      if (rate) {
        cost += hours * rate;
        costCoveredHours += hours;
      }
    }

    const live = tasks.filter((t) => t.status !== "CANCELLED");
    const milestones = live.filter((t) => t.isMilestone);
    const statusCounts = countByStatus(tasks);
    const workload = buildWorkload(live, today).map((row) => ({
      ...row,
      name: row.assigneeId ? nameById.get(row.assigneeId) ?? "Usuário" : "Sem responsável",
    }));

    // Hours per week (last 12 weeks).
    const weeks = new Map<string, number>();
    const firstWeek = new Date(weekStart(today).getTime() - 11 * 7 * DAY_MS);
    for (let i = 0; i < 12; i++) weeks.set(toDateKey(new Date(firstWeek.getTime() + i * 7 * DAY_MS)), 0);
    for (const entry of entries) {
      const key = toDateKey(weekStart(entry.date));
      if (weeks.has(key)) weeks.set(key, weeks.get(key)! + entry.minutes / 60);
    }

    const upcoming = live
      .filter((t) => t.dueDate && !isClosedStatus(t.status) && t.dueDate.getTime() <= today.getTime() + 14 * DAY_MS)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        dueDate: t.dueDate!,
        status: t.status,
        isMilestone: t.isMilestone,
        overdue: isOverdue(t, today),
        assignee: t.assigneeId ? nameById.get(t.assigneeId) ?? null : null,
      }));

    const usage =
      project.client && project.contract
        ? (await contractUsageService.getMonthlyUsage(ctx.organizationId, currentMonth(), [project.client.id]))[0] ?? null
        : null;

    return {
      project,
      kpis: {
        progress: project.progress,
        expectedProgress: expectedProgress(project.plannedStartDate, project.plannedEndDate, today),
        total: live.length,
        done: statusCounts.DONE,
        open: project.openCount,
        overdue: project.overdueCount,
        blocked: statusCounts.BLOCKED,
        milestonesTotal: milestones.length,
        milestonesDone: milestones.filter((m) => m.status === "DONE").length,
        loggedHours: project.loggedHours,
        estimateHours: Math.round(live.reduce((s, t) => s + (t.estimateHours ?? 0), 0) * 10) / 10,
        budgetHours: project.budgetHours,
        cost: Math.round(cost * 100) / 100,
        costCoveredHours: Math.round(costCoveredHours * 10) / 10,
        budgetAmount: project.budgetAmount,
      },
      statusCounts,
      burn: buildBurnSeries(live, project.plannedStartDate, project.plannedEndDate, today),
      workload,
      hoursByWeek: [...weeks.entries()].map(([week, hours]) => ({ week, hours: Math.round(hours * 10) / 10 })),
      upcoming,
      usage,
    };
  },
};

export type ProjectDashboardData = NonNullable<Awaited<ReturnType<typeof projectDashboardService.get>>>;
