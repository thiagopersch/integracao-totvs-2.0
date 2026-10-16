import { prisma } from "@/lib/prisma";
import { getTodayDateOnly } from "@/lib/export-period";
import {
  CLOSED_TASK_STATUSES,
  PRIORITIES,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROJECT_HEALTHS,
  PROJECT_HEALTH_COLORS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PRIORITY_RANK,
  byPriority,
  type TaskStatus,
} from "@/lib/projects";
import { projectService, type ProjectCtx } from "@/services/project.service";

const DAY_MS = 86_400_000;
const ACTIVE_STATUSES = ["PLANNING", "IN_PROGRESS", "ON_HOLD"] as const;
const HEALTH_SEVERITY: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
/** Projects without a computed health (e.g. not planned yet) go last. */
const severity = (health: string | null) => (health ? (HEALTH_SEVERITY[health] ?? 3) : 3);

const time = (date: Date | null) => (date ? date.getTime() : Number.POSITIVE_INFINITY);

/**
 * Dashboard snapshot of the Gestão de Projetos module (current state, not period-filtered): KPIs,
 * projects needing attention, the user's tasks, upcoming/overdue deadlines and chart series.
 * Scoped like the projects list (client access via `projectService.list`).
 */
export const projectPortfolioService = {
  async get(ctx: ProjectCtx) {
    const today = getTodayDateOnly();
    const soon = new Date(today.getTime() + 7 * DAY_MS);
    const { data: projects } = await projectService.list({ page: 1, pageSize: 2000 }, ctx, []);
    const active = projects.filter((p) => (ACTIVE_STATUSES as readonly string[]).includes(p.status));

    const tasks = await prisma.projectTask.findMany({
      where: {
        projectId: { in: active.map((p) => p.id) },
        deletedAt: null,
        status: { notIn: [...CLOSED_TASK_STATUSES] as TaskStatus[] },
      },
      select: {
        id: true,
        number: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        assigneeId: true,
        assignee: { select: { name: true, image: true } },
        project: { select: { id: true, code: true, name: true, color: true } },
        stage: { select: { name: true, color: true } },
      },
      take: 20000,
    });

    const isOverdue = (t: (typeof tasks)[number]) => !!t.dueDate && t.dueDate < today;
    const isDueSoon = (t: (typeof tasks)[number]) => !!t.dueDate && t.dueDate >= today && t.dueDate <= soon;
    const byUrgency = (a: (typeof tasks)[number], b: (typeof tasks)[number]) => byPriority(a, b) || time(a.dueDate) - time(b.dueDate) || a.number - b.number;
    const mine = tasks.filter((t) => t.assigneeId === ctx.userId);

    const attentionProjects = [...active]
      .sort(
        (a, b) =>
          severity(a.health) - severity(b.health) ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          time(a.plannedEndDate) - time(b.plannedEndDate),
      )
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        color: p.color,
        status: p.status,
        health: p.health,
        healthAuto: p.healthAuto,
        healthReasons: p.healthReasons,
        priority: p.priority,
        progress: p.progress,
        plannedEndDate: p.plannedEndDate,
        openCount: p.openCount,
        overdueCount: p.overdueCount,
        taskCount: p.taskCount,
        doneCount: p.doneCount,
        client: p.client,
        manager: p.manager ? { name: p.manager.name } : null,
      }));

    const workload = new Map<string, { name: string; value: number }>();
    for (const t of tasks) {
      const key = t.assigneeId ?? "none";
      const row = workload.get(key) ?? { name: t.assignee?.name ?? "Sem responsável", value: 0 };
      row.value++;
      workload.set(key, row);
    }

    return {
      kpis: {
        activeProjects: active.length,
        totalProjects: projects.length,
        atRiskProjects: active.filter((p) => p.health === "RED" || p.health === "YELLOW").length,
        openTasks: tasks.length,
        blockedTasks: tasks.filter((t) => t.status === "BLOCKED").length,
        overdueTasks: tasks.filter(isOverdue).length,
        dueSoonTasks: tasks.filter(isDueSoon).length,
        myOpenTasks: mine.length,
        myDueSoonTasks: mine.filter((t) => isOverdue(t) || isDueSoon(t)).length,
        loggedHours: Math.round(active.reduce((sum, p) => sum + p.loggedHours, 0) * 10) / 10,
        budgetHours: active.reduce((sum, p) => sum + (p.budgetHours ?? 0), 0),
      },
      attentionProjects,
      myTasks: [...mine].sort(byUrgency).slice(0, 10),
      // Overdue first (oldest first), then the next 7 days, most urgent priority first on ties.
      dueTasks: tasks
        .filter((t) => isOverdue(t) || isDueSoon(t))
        .sort((a, b) => time(a.dueDate) - time(b.dueDate) || byPriority(a, b))
        .slice(0, 10)
        .map((t) => ({ ...t, overdue: isOverdue(t) })),
      charts: {
        projectsByStatus: PROJECT_STATUSES.map((s) => ({
          name: PROJECT_STATUS_LABELS[s],
          value: projects.filter((p) => p.status === s).length,
          color: PROJECT_STATUS_COLORS[s],
        })).filter((r) => r.value > 0),
        projectsByHealth: PROJECT_HEALTHS.map((h) => ({
          name: PROJECT_HEALTH_LABELS[h],
          value: active.filter((p) => p.health === h).length,
          color: PROJECT_HEALTH_COLORS[h],
        })).filter((r) => r.value > 0),
        tasksByPriority: [...PRIORITIES]
          .reverse()
          .map((p) => ({ name: PRIORITY_LABELS[p], value: tasks.filter((t) => t.priority === p).length, color: PRIORITY_COLORS[p] }))
          .filter((r) => r.value > 0),
        tasksByAssignee: [...workload.values()].sort((a, b) => b.value - a.value).slice(0, 10),
        hoursByProject: active
          .filter((p) => p.loggedHours > 0 || p.budgetHours)
          .map((p) => ({ name: p.code, apontadas: p.loggedHours, orcamento: p.budgetHours ?? 0, color: p.color }))
          .sort((a, b) => b.apontadas - a.apontadas)
          .slice(0, 12),
      },
    };
  },
};

export type ProjectPortfolio = Awaited<ReturnType<typeof projectPortfolioService.get>>;
