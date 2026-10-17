import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 60_000;

/** Guards against double-registration under Next.js dev HMR / multiple `register()` calls. */
let started = false;

/**
 * In-process poller for the demands report schedules (Integrações > Envio de Relatórios) — every
 * minute, sends the reports whose `nextRunAt` has passed. Same model as lib/backup-scheduler.ts.
 */
export function startDemandReportScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const { demandReportService } = await import("@/services/demand-report.service");
      const { processed } = await demandReportService.runDueSchedules();
      if (processed > 0) logger.info(`Scheduler de relatórios: ${processed} regra(s) de envio processada(s)`);
    } catch (error) {
      logger.error("Scheduler de relatórios falhou", { error: (error as Error).message });
    }
  }

  setInterval(tick, POLL_INTERVAL_MS);
  void tick();
  logger.info("Scheduler de relatórios de demandas iniciado (verificação a cada 60s)");
}
