export async function register() {
  process.env.TZ = process.env.APP_TZ ?? "UTC";

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup-scheduler");
    startBackupScheduler();
    const { startProjectDeadlineScheduler } = await import("@/lib/project-deadline-scheduler");
    startProjectDeadlineScheduler();
    const { startDemandReportScheduler } = await import("@/lib/demand-report-scheduler");
    startDemandReportScheduler();
    const { startDemandSheetSyncScheduler } = await import("@/lib/demand-sheet-sync-scheduler");
    startDemandSheetSyncScheduler();
  }
}
