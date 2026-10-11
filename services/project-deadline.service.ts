import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getTodayDateOnly } from "@/lib/export-period";
import { CLOSED_TASK_STATUSES, parseProjectSettings, taskKey } from "@/lib/projects";
import { DIGEST_THRESHOLD, classifyDue } from "@/lib/project-deadlines";
import {
  buildProjectTaskDueDigestNotification,
  buildProjectTaskDueSoonNotification,
  buildProjectTaskOverdueNotification,
} from "@/lib/notification-types";
import { notificationService } from "@/services/notification.service";

const LOOKAHEAD_DAYS = 30;

type Candidate = {
  organizationId: string;
  taskId: string;
  userId: string;
  dueDate: Date;
  kind: "DUE_SOON" | "OVERDUE";
  days: number;
  ref: { projectId: string; projectCode: string; projectName: string; taskId: string; taskNumber: number; taskTitle: string };
};

export const projectDeadlineService = {
  /**
   * One pass of the deadline poller: for every open task of an active project due within the
   * project's window (or overdue), notifies the assignee — or the manager when unassigned — once
   * per (task, person, kind, due date). Dedup is the unique row in `project_task_due_alerts`
   * (skipDuplicates + only inserted rows notify), so concurrent ticks never double-notify and a
   * new due date / assignee re-arms the alert. Writes nothing a cached read depends on.
   */
  async runDueDateAlerts(): Promise<{ created: number }> {
    const today = getTodayDateOnly();
    const tasks = await prisma.projectTask.findMany({
      where: {
        deletedAt: null,
        status: { notIn: [...CLOSED_TASK_STATUSES] },
        dueDate: { not: null, lte: new Date(today.getTime() + LOOKAHEAD_DAYS * 86_400_000) },
        project: { deletedAt: null, status: { in: ["PLANNING", "IN_PROGRESS"] } },
      },
      select: {
        id: true,
        number: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        organizationId: true,
        project: { select: { id: true, code: true, name: true, managerId: true, clientId: true, settings: true } },
      },
    });

    const candidates: Candidate[] = [];
    for (const task of tasks) {
      const userId = task.assigneeId ?? task.project.managerId;
      if (!userId || !task.dueDate) continue;
      const settings = parseProjectSettings(task.project.settings);
      const due = classifyDue(task.dueDate, today, settings.dueSoonDays);
      if (!due) continue;
      candidates.push({
        organizationId: task.organizationId,
        taskId: task.id,
        userId,
        dueDate: task.dueDate,
        kind: due.kind,
        days: due.kind === "OVERDUE" ? due.daysLate : due.daysLeft,
        ref: {
          projectId: task.project.id,
          projectCode: task.project.code,
          projectName: task.project.name,
          taskId: task.id,
          taskNumber: task.number,
          taskTitle: task.title,
        },
      });
    }
    if (candidates.length === 0) return { created: 0 };

    // Recipients must be active and (for client projects) still have access to that client.
    const userIds = [...new Set(candidates.map((c) => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null, status: true },
      select: { id: true, allowedClients: { select: { clientId: true } } },
    });
    const clientsByUser = new Map(users.map((u) => [u.id, new Set(u.allowedClients.map((c) => c.clientId))]));
    const clientByTask = new Map(tasks.map((t) => [t.id, t.project.clientId]));
    const eligible = candidates.filter((c) => {
      const clients = clientsByUser.get(c.userId);
      if (!clients) return false;
      const clientId = clientByTask.get(c.taskId);
      return !clientId || clients.has(clientId);
    });
    if (eligible.length === 0) return { created: 0 };

    const inserted = await prisma.projectTaskDueAlert.createManyAndReturn({
      data: eligible.map((c) => ({ organizationId: c.organizationId, taskId: c.taskId, userId: c.userId, kind: c.kind, dueDate: c.dueDate })),
      skipDuplicates: true,
      select: { taskId: true, userId: true, kind: true },
    });
    const insertedKeys = new Set(inserted.map((r) => `${r.taskId}:${r.userId}:${r.kind}`));
    const fresh = eligible.filter((c) => insertedKeys.has(`${c.taskId}:${c.userId}:${c.kind}`));

    const byUser = new Map<string, Candidate[]>();
    for (const c of fresh) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c]);

    for (const [userId, items] of byUser) {
      try {
        if (items.length > DIGEST_THRESHOLD) {
          const overdue = items.filter((i) => i.kind === "OVERDUE");
          await notificationService.create({
            organizationId: items[0].organizationId,
            userId,
            ...buildProjectTaskDueDigestNotification({
              overdue: overdue.length,
              dueSoon: items.length - overdue.length,
              tasks: items.map((i) => `${taskKey(i.ref.projectCode, i.ref.taskNumber)} ${i.ref.taskTitle}`),
            }),
          });
          continue;
        }
        for (const item of items) {
          await notificationService.create({
            organizationId: item.organizationId,
            userId,
            ...(item.kind === "OVERDUE"
              ? buildProjectTaskOverdueNotification({ ...item.ref, dueDate: item.dueDate, daysLate: item.days })
              : buildProjectTaskDueSoonNotification({ ...item.ref, dueDate: item.dueDate, daysLeft: item.days })),
          });
        }
      } catch (error) {
        logger.error("Falha ao enviar alerta de prazo de tarefa", { userId, error: (error as Error).message });
      }
    }
    return { created: fresh.length };
  },
};
