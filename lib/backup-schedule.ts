import { fromZonedTime, toZonedTime } from "date-fns-tz";

import type { BackupSchedule } from "@/generated/prisma/client";
import { APP_TIME_ZONE } from "@/utils/format";

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
 * those cycles fires at, interpreted in `APP_TIME_ZONE` (the timezone the "Horário da execução"
 * field is filled in, regardless of the process's own `TZ`); EVERY_3H/6H/12H are pure intervals
 * and ignore it.
 */
export function computeNextRunAt(schedule: BackupSchedule, from: Date, time?: string | null): Date | null {
  switch (schedule) {
    case "NONE":
      return null;
    case "EVERY_3H": {
      const next = new Date(from);
      next.setHours(next.getHours() + 3);
      return next;
    }
    case "EVERY_6H": {
      const next = new Date(from);
      next.setHours(next.getHours() + 6);
      return next;
    }
    case "EVERY_12H": {
      const next = new Date(from);
      next.setHours(next.getHours() + 12);
      return next;
    }
    case "DAILY": {
      const zoned = toZonedTime(from, APP_TIME_ZONE);
      zoned.setDate(zoned.getDate() + 1);
      applyTimeOfDay(zoned, time);
      return fromZonedTime(zoned, APP_TIME_ZONE);
    }
    case "WEEKLY": {
      const zoned = toZonedTime(from, APP_TIME_ZONE);
      zoned.setDate(zoned.getDate() + 7);
      applyTimeOfDay(zoned, time);
      return fromZonedTime(zoned, APP_TIME_ZONE);
    }
    case "MONTHLY": {
      const zoned = toZonedTime(from, APP_TIME_ZONE);
      zoned.setMonth(zoned.getMonth() + 1);
      applyTimeOfDay(zoned, time);
      return fromZonedTime(zoned, APP_TIME_ZONE);
    }
    default:
      return null;
  }
}

/** `date` must already be a zoned representation (see `toZonedTime` above) — mutates it in place. */
function applyTimeOfDay(date: Date, time?: string | null) {
  if (!time) return;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
  date.setHours(hours, minutes, 0, 0);
}

/** Schedules that repeat on a calendar cadence (vs. a pure hour interval) — these accept a time of day. */
export const SCHEDULES_WITH_TIME_OF_DAY = new Set<BackupSchedule>(["DAILY", "WEEKLY", "MONTHLY"]);
