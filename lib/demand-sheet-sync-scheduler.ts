import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 60_000;

/** Guards against double-registration under Next.js dev HMR / multiple `register()` calls. */
let started = false;

/**
 * In-process poller for the Google Sheets syncs (Integrações > Planilhas Google) — every minute,
 * rewrites the spreadsheets whose `nextRunAt` or debounced `pendingSyncAt` has passed. Same model
 * as lib/demand-report-scheduler.ts.
 */
export function startDemandSheetSyncScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const { demandSheetSyncService } = await import("@/services/demand-sheet-sync.service");
      const { processed } = await demandSheetSyncService.runDue();
      if (processed > 0) logger.info(`Scheduler de planilhas Google: ${processed} planilha(s) atualizada(s)`);
    } catch (error) {
      logger.error("Scheduler de planilhas Google falhou", { error: (error as Error).message });
    }
  }

  setInterval(tick, POLL_INTERVAL_MS);
  void tick();
  logger.info("Scheduler de planilhas Google iniciado (verificação a cada 60s)");
}
