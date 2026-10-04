import type { Period } from "@/lib/period";

/** Monthly consumption percentages that trigger a contract usage alert. Each threshold is notified
 *  only once per client per month (dedup in `contract_usage_alerts`). */
export const CONTRACT_ALERT_THRESHOLDS = [80, 85, 90, 95, 100] as const;

/** Minimum percentage for a contract to be shown as "em atenção" (dashboard / contracts table). */
export const CONTRACT_ATTENTION_PERCENT = CONTRACT_ALERT_THRESHOLDS[0];

export type UsageLevel = "ok" | "warning" | "critical" | "exceeded";

export const USAGE_LEVEL_COLORS: Record<UsageLevel, string> = {
  ok: "#22c55e",
  warning: "#eab308",
  critical: "#f97316",
  exceeded: "#ef4444",
};

export const USAGE_LEVEL_LABELS: Record<UsageLevel, string> = {
  ok: "Normal",
  warning: "Atenção",
  critical: "Crítico",
  exceeded: "Excedido",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function usagePercent(usedHours: number, contractedHours: number): number {
  if (contractedHours <= 0) return 0;
  return round2((usedHours / contractedHours) * 100);
}

export function usageLevel(percent: number): UsageLevel {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= CONTRACT_ATTENTION_PERCENT) return "warning";
  return "ok";
}

/** Dashboard card tone: green below the attention threshold, yellow from 80% up to 90%, red from 90%. */
export type UsageTone = "ok" | "warning" | "danger";

export function usageTone(percent: number): UsageTone {
  if (percent >= 90) return "danger";
  if (percent >= CONTRACT_ATTENTION_PERCENT) return "warning";
  return "ok";
}

export const USAGE_TONE_CLASSES: Record<UsageTone, string> = {
  ok: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
  warning: "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30",
  danger: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
};

/** Every alert threshold reached by `percent` (inclusive), ascending. */
export function crossedThresholds(percent: number): number[] {
  return CONTRACT_ALERT_THRESHOLDS.filter((t) => percent >= t);
}

/** Thresholds reached by `percent` that weren't alerted yet. */
export function pendingThresholds(percent: number, alreadyAlerted: Iterable<number>): number[] {
  const done = new Set(alreadyAlerted);
  return crossedThresholds(percent).filter((t) => !done.has(t));
}

/** "2026-10" — the dedup key stored in `contract_usage_alerts.period`. */
export function periodKey(period: { year: number; month: number }): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

/** Month a `Demand.date` belongs to — demand dates are stored as UTC midnights (see lib/period.ts). */
export function monthOf(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Current calendar month (UTC, matching how demand dates are bucketed). */
export function currentMonth(now = new Date()): { year: number; month: number } {
  return monthOf(now);
}

/** Month to evaluate for a selected period: its own month, or the current month when the period
 *  is year-only / absent. */
export function monthForPeriod(period: Period | null, now = new Date()): { year: number; month: number } {
  if (period?.month) return { year: period.year, month: period.month };
  return currentMonth(now);
}

export function formatMonthLabel(period: { year: number; month: number }): string {
  const label = new Date(Date.UTC(period.year, period.month - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.replace(" de ", "/");
}

export function formatHours(hours: number): string {
  return `${hours.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}h`;
}
