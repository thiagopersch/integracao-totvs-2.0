import type { BackupSchedule } from "@prisma/client";

export const BACKUP_SCHEDULE_LABELS: Record<BackupSchedule, string> = {
  NONE: "Sem execução programada",
  EVERY_3H: "3h",
  EVERY_6H: "6h",
  EVERY_12H: "12h",
  DAILY: "1 dia",
  WEEKLY: "1 Semana",
  MONTHLY: "1 Mês",
};

/** Anchored to `from` (the moment the schedule was saved / last ran), not to midnight or any fixed clock. */
export function computeNextRunAt(schedule: BackupSchedule, from: Date): Date | null {
  const next = new Date(from);
  switch (schedule) {
    case "NONE":
      return null;
    case "EVERY_3H":
      next.setHours(next.getHours() + 3);
      return next;
    case "EVERY_6H":
      next.setHours(next.getHours() + 6);
      return next;
    case "EVERY_12H":
      next.setHours(next.getHours() + 12);
      return next;
    case "DAILY":
      next.setDate(next.getDate() + 1);
      return next;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      return next;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}
