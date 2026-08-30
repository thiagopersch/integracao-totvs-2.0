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

/**
 * Anchored to `from` (the moment the schedule was saved / last ran), not to midnight or any fixed
 * clock. `time` ("HH:mm") only applies to DAILY/WEEKLY/MONTHLY — it pins the hour of day each of
 * those cycles fires at; EVERY_3H/6H/12H are pure intervals and ignore it.
 */
export function computeNextRunAt(schedule: BackupSchedule, from: Date, time?: string | null): Date | null {
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
      applyTimeOfDay(next, time);
      return next;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      applyTimeOfDay(next, time);
      return next;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      applyTimeOfDay(next, time);
      return next;
    default:
      return null;
  }
}

function applyTimeOfDay(date: Date, time?: string | null) {
  if (!time) return;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
  date.setHours(hours, minutes, 0, 0);
}

/** Schedules that repeat on a calendar cadence (vs. a pure hour interval) — these accept a time of day. */
export const SCHEDULES_WITH_TIME_OF_DAY = new Set<BackupSchedule>(["DAILY", "WEEKLY", "MONTHLY"]);
