import { toZonedTime } from "date-fns-tz";
import { formatMonthLabel } from "@/lib/contract-usage";
import { APP_TIME_ZONE } from "@/utils/format";

/** Reference period of a demands report, always relative to the moment it is sent (a schedule that
 *  runs in October/2026 with "currentMonth" reports October/2026). */
export type ReportPeriodKind = "currentMonth" | "previousMonth" | "last7days" | "last15days" | "last30days";

export const REPORT_PERIOD_KINDS: ReportPeriodKind[] = ["currentMonth", "previousMonth", "last7days", "last15days", "last30days"];

export const REPORT_PERIOD_LABELS: Record<ReportPeriodKind, string> = {
  currentMonth: "Mês atual",
  previousMonth: "Mês anterior",
  last7days: "Últimos 7 dias",
  last15days: "Últimos 15 dias",
  last30days: "Últimos 30 dias",
};

/** Google Sheets syncs fill the tab of one month ("Outubro26"), so only month periods apply. */
export const SHEET_SYNC_PERIODS = ["currentMonth", "previousMonth"] as const satisfies readonly ReportPeriodKind[];

export function isReportPeriodKind(value: unknown): value is ReportPeriodKind {
  return typeof value === "string" && (REPORT_PERIOD_KINDS as string[]).includes(value);
}

export interface ResolvedReportPeriod {
  /** `demand.date` range (UTC midnights, same convention as lib/export-period.ts). */
  gte: Date;
  lt: Date;
  /** "outubro/2026" for month periods, "10/10/2026 a 16/10/2026" otherwise. */
  label: string;
  startLabel: string;
  endLabel: string;
  /** "2026-10" / "2026-10-10_2026-10-16" — safe for file names. */
  slug: string;
}

const DAY = 24 * 60 * 60 * 1000;
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function resolveReportPeriod(kind: ReportPeriodKind, now = new Date()): ResolvedReportPeriod {
  const zoned = toZonedTime(now, APP_TIME_ZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const today = new Date(Date.UTC(year, month, zoned.getDate()));

  if (kind === "currentMonth" || kind === "previousMonth") {
    const offset = kind === "previousMonth" ? -1 : 0;
    const gte = new Date(Date.UTC(year, month + offset, 1));
    const lt = new Date(Date.UTC(year, month + offset + 1, 1));
    const ref = { year: gte.getUTCFullYear(), month: gte.getUTCMonth() + 1 };
    return {
      gte,
      lt,
      label: formatMonthLabel(ref),
      startLabel: fmt(gte),
      endLabel: fmt(new Date(lt.getTime() - DAY)),
      slug: `${ref.year}-${String(ref.month).padStart(2, "0")}`,
    };
  }

  const days = kind === "last7days" ? 7 : kind === "last15days" ? 15 : 30;
  const gte = new Date(today.getTime() - (days - 1) * DAY);
  const lt = new Date(today.getTime() + DAY);
  return {
    gte,
    lt,
    label: `${fmt(gte)} a ${fmt(today)}`,
    startLabel: fmt(gte),
    endLabel: fmt(today),
    slug: `${iso(gte)}_${iso(today)}`,
  };
}
