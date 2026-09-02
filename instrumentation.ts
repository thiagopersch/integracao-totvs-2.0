export async function register() {
  process.env.TZ = process.env.APP_TZ ?? "UTC";

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup-scheduler");
    startBackupScheduler();
  }
}
