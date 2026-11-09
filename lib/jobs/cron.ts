import { logger } from "@/lib/logger";

/**
 * The periodic tasks, shared by the QStash schedules (`/api/cron/<task>`, see
 * scripts/sync-qstash-schedules.ts) and the in-process pollers (instrumentation.ts, only with
 * RUN_INPROCESS_SCHEDULERS=true). Each tick is cheap: it finds what is due and enqueues jobs.
 */
export const CRON_TASKS = {
  backup: {
    cron: "* * * * *",
    async run() {
      const { backupService } = await import("@/services/backup.service");
      return backupService.runDueScheduledBackups();
    },
  },
  "project-deadline": {
    cron: "*/15 * * * *",
    async run() {
      const { withLock } = await import("@/lib/locks");
      const { projectDeadlineService } = await import("@/services/project-deadline.service");
      const outcome = await withLock("scheduler:project-deadline", 10 * 60_000, () => projectDeadlineService.runDueDateAlerts());
      return outcome.skipped ? { created: 0, skipped: "locked" } : outcome.value;
    },
  },
  "demand-report": {
    cron: "* * * * *",
    async run() {
      const { demandReportService } = await import("@/services/demand-report.service");
      return demandReportService.runDueSchedules();
    },
  },
  "sheet-sync": {
    cron: "* * * * *",
    async run() {
      const { demandSheetSyncService } = await import("@/services/demand-sheet-sync.service");
      return demandSheetSyncService.runDue();
    },
  },
} as const;

export type CronTask = keyof typeof CRON_TASKS;

export function isCronTask(value: string): value is CronTask {
  return Object.prototype.hasOwnProperty.call(CRON_TASKS, value);
}

export async function runCronTask(task: CronTask): Promise<unknown> {
  const started = Date.now();
  try {
    const result = await CRON_TASKS[task].run();
    logger.debug(`Cron ${task} concluído em ${Date.now() - started} ms`, { result: result as Record<string, unknown> });
    return result;
  } catch (error) {
    logger.error(`Cron ${task} falhou`, { error: (error as Error).message });
    throw error;
  }
}
