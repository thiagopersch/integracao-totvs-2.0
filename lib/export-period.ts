import { addDays, subDays, subMonths } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { periodToDateRange, type Period } from "@/lib/period";
import { APP_TIME_ZONE } from "@/utils/format";

export type ExportPeriod =
  | { kind: "yearMonth"; period: Period }
  | { kind: "last7days" }
  | { kind: "last15days" }
  | { kind: "lastMonth" }
  | { kind: "last6months" }
  | { kind: "lastYear" }
  | { kind: "custom"; from: string; to: string };

/** "Today" as a date-only value (UTC midnight for the calendar day in APP_TIME_ZONE) — matches the
 *  convention that `demand.date` is always stored at UTC midnight (see `utils/format.ts`). */
function getTodayDateOnly(): Date {
  const zoned = toZonedTime(new Date(), APP_TIME_ZONE);
  return new Date(Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate()));
}

export function resolveExportPeriodRange(period: ExportPeriod | null): { gte: Date; lt: Date } | undefined {
  if (!period) return undefined;

  const today = getTodayDateOnly();
  const tomorrow = addDays(today, 1);

  switch (period.kind) {
    case "yearMonth":
      return periodToDateRange(period.period);
    case "last7days":
      return { gte: subDays(today, 6), lt: tomorrow };
    case "last15days":
      return { gte: subDays(today, 14), lt: tomorrow };
    case "lastMonth": {
      const gte = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const lt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { gte, lt };
    }
    case "last6months":
      return { gte: subMonths(today, 6), lt: tomorrow };
    case "lastYear": {
      const gte = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
      const lt = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      return { gte, lt };
    }
    case "custom":
      return { gte: new Date(period.from), lt: addDays(new Date(period.to), 1) };
  }
}
