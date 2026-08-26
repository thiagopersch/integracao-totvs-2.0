import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 60_000;

/** Guards against double-registration under Next.js dev HMR / multiple `register()` calls. */
let started = false;

/**
 * In-process poller for `Filter.schedule` (the "Agendamento" field) — every minute, checks which
 * filters are due (`nextRunAt <= now`) and runs their backup. Started once from instrumentation.ts
 * on server boot; requires a long-lived Node process (not compatible with edge/serverless-per-request
 * deployments, which this app isn't).
 */
export function startBackupScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const { backupService } = await import("@/services/backup.service");
      const { processed } = await backupService.runDueScheduledBackups();
      if (processed > 0) logger.info(`Scheduler de backups: ${processed} filtro(s) processado(s)`);
    } catch (error) {
      logger.error("Scheduler de backups falhou", { error: (error as Error).message });
    }
  }

  setInterval(tick, POLL_INTERVAL_MS);
  void tick();
  logger.info("Scheduler de backups iniciado (verificação a cada 60s)");
}
