import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { BackupSchedule } from "@/generated/prisma/client";
import { computeNextRunAt } from "@/lib/backup-schedule";
import { APP_TIME_ZONE } from "@/utils/format";

export const DEFAULT_REPORT_TIME = "08:00";

function parseTime(time?: string | null): [number, number] {
  const [h, m] = (time || DEFAULT_REPORT_TIME).split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? [8, 0] : [h, m];
}

/**
 * Next send of a demands report schedule, strictly after `from`. Times are wall-clock in
 * APP_TIME_ZONE (the timezone the "Horário" field is filled in).
 * - DAILY: next occurrence of `time`.
 * - MONTHLY: `dayOfMonth` (clamped to the month's last day; null = last day of the month) at `time`.
 * - Everything else follows the backup schedules (lib/backup-schedule.ts), anchored to `from`.
 */
export function computeNextReportRunAt(
  schedule: BackupSchedule,
  from: Date,
  time?: string | null,
  dayOfMonth?: number | null
): Date | null {
  const [hours, minutes] = parseTime(time);
  const zoned = toZonedTime(from, APP_TIME_ZONE);

  if (schedule === "DAILY") {
    for (let offset = 0; offset <= 1; offset++) {
      const candidate = new Date(zoned.getFullYear(), zoned.getMonth(), zoned.getDate() + offset, hours, minutes, 0, 0);
      const instant = fromZonedTime(candidate, APP_TIME_ZONE);
      if (instant > from) return instant;
    }
  }

  if (schedule === "MONTHLY") {
    for (let offset = 0; offset <= 2; offset++) {
      const year = zoned.getFullYear();
      const month = zoned.getMonth() + offset;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const day = dayOfMonth ? Math.min(dayOfMonth, lastDay) : lastDay;
      const candidate = new Date(year, month, day, hours, minutes, 0, 0);
      const instant = fromZonedTime(candidate, APP_TIME_ZONE);
      if (instant > from) return instant;
    }
  }

  return computeNextRunAt(schedule, from, time);
}

/** Frequencies offered by the report schedules (the backup set minus the hour intervals). */
export const REPORT_SCHEDULES: BackupSchedule[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY"];

export const REPORT_SCHEDULE_LABELS: Record<string, string> = {
  NONE: "Somente manual (botão Enviar agora)",
  DAILY: "Diário",
  WEEKLY: "Semanal (a partir da data em que foi salvo)",
  MONTHLY: "Mensal",
};
