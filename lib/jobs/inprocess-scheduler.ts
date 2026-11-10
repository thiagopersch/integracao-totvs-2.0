import { logger } from "@/lib/logger";
import { CRON_TASKS, runCronTask, type CronTask } from "@/lib/jobs/cron";

/** Same ticks as the QStash schedules, for long-lived servers (Docker, `next dev`). */
const INTERVAL_MS: Record<CronTask, number> = {
  backup: 60_000,
  "project-deadline": 15 * 60_000,
  "demand-report": 60_000,
  "sheet-sync": 60_000,
};

const globalForScheduler = globalThis as unknown as { inprocessSchedulerStarted?: boolean };

/**
 * Polls every periodic task in this process. Only started when RUN_INPROCESS_SCHEDULERS=true
 * (instrumentation.ts): on Vercel the QStash schedules call /api/cron/* instead, since a frozen
 * serverless instance can't keep a setInterval alive. Locks (lib/locks.ts) keep it safe to run
 * next to the QStash schedules or on several containers.
 */
export function startInprocessSchedulers() {
  if (globalForScheduler.inprocessSchedulerStarted) return;
  globalForScheduler.inprocessSchedulerStarted = true;
  for (const task of Object.keys(CRON_TASKS) as CronTask[]) {
    const tick = () => void runCronTask(task).catch(() => {});
    setInterval(tick, INTERVAL_MS[task]);
    tick();
  }
  logger.info("Agendamentos em processo iniciados (RUN_INPROCESS_SCHEDULERS=true)");
}
