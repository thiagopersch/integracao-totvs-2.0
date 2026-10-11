import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 15 * 60_000;

/** Guards against double-registration under Next.js dev HMR / multiple `register()` calls. */
let started = false;

/**
 * In-process poller for project task deadlines (Gestão de Projetos) — every 15 minutes notifies
 * assignees of tasks due soon / overdue (deduped per task+person+kind+due date, see
 * projectDeadlineService). Started once from instrumentation.ts, same model as the backup scheduler.
 */
export function startProjectDeadlineScheduler() {
  if (started) return;
  started = true;

  async function tick() {
    try {
      const { projectDeadlineService } = await import("@/services/project-deadline.service");
      const { created } = await projectDeadlineService.runDueDateAlerts();
      if (created > 0) logger.info(`Alertas de prazo de projetos: ${created} alerta(s) enviado(s)`);
    } catch (error) {
      logger.error("Verificação de prazos de projetos falhou", { error: (error as Error).message });
    }
  }

  setInterval(tick, POLL_INTERVAL_MS);
  void tick();
  logger.info("Scheduler de prazos de projetos iniciado (verificação a cada 15 min)");
}
