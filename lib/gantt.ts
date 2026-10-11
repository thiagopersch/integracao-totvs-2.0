import type { GanttZoom } from "@/lib/project-workspace-params";

/**
 * Pure geometry for the project timeline (Gantt). All dates are date-only at UTC midnight; one
 * day = `pxPerDay` pixels. Client-safe.
 */

export const DAY_MS = 86_400_000;

export const GANTT_PX_PER_DAY: Record<GanttZoom, number> = { day: 40, week: 18, month: 5 };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function utcDay(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Visible range: every task date and today, padded (1 week before, 2 after), aligned to the zoom
 * unit. `from` (yyyy-MM-dd) pins the start when the user scrolled/paged the timeline.
 */
export function computeRange(
  dates: (Date | string | null | undefined)[],
  today: Date,
  zoom: GanttZoom,
  from?: string,
): { start: Date; end: Date; days: number } {
  const times = dates.filter((d): d is Date | string => !!d).map((d) => utcDay(d).getTime());
  times.push(today.getTime());
  let start = addDays(new Date(Math.min(...times)), -7);
  let end = addDays(new Date(Math.max(...times)), 14);
  if (from) start = utcDay(from);
  if (zoom === "week") start = startOfWeek(start);
  if (zoom === "month") start = startOfMonth(start);
  const minDays = zoom === "day" ? 30 : zoom === "week" ? 84 : 365;
  if (diffDays(end, start) < minDays) end = addDays(start, minDays);
  return { start, end, days: diffDays(end, start) + 1 };
}

export function dateToX(date: Date | string, rangeStart: Date, pxPerDay: number): number {
  return diffDays(utcDay(date), rangeStart) * pxPerDay;
}

/** Drag distance in pixels → whole days. */
export function pxToDays(dx: number, pxPerDay: number): number {
  return Math.round(dx / pxPerDay);
}

/**
 * Bar box for a task: start → due inclusive. Tasks with only one date get a 1-day bar; milestones
 * are drawn as a diamond centred on their (due) date. Null when the task has no dates.
 */
export function barGeometry(
  task: { startDate: Date | string | null; dueDate: Date | string | null },
  rangeStart: Date,
  pxPerDay: number,
): { x: number; width: number; start: Date; end: Date } | null {
  const startValue = task.startDate ?? task.dueDate;
  const endValue = task.dueDate ?? task.startDate;
  if (!startValue || !endValue) return null;
  const start = utcDay(startValue);
  const end = utcDay(endValue);
  const x = dateToX(start, rangeStart, pxPerDay);
  const width = Math.max(1, diffDays(end, start) + 1) * pxPerDay;
  return { x, width, start, end };
}

/**
 * Elbow path for a finish-to-start arrow from the end of `from` to the start of `to` (row indices,
 * row height in px). When the successor starts before the predecessor ends, the line detours
 * below the predecessor row.
 */
export function dependencyPath(
  from: { x: number; width: number; row: number },
  to: { x: number; row: number },
  rowHeight: number,
): string {
  const gap = 8;
  const fromX = from.x + from.width;
  const fromY = from.row * rowHeight + rowHeight / 2;
  const toY = to.row * rowHeight + rowHeight / 2;
  const toX = to.x;
  if (toX >= fromX + gap * 2) {
    const midX = fromX + gap;
    return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX - 2}`;
  }
  const detourY = (from.row + (to.row > from.row ? 1 : 0)) * rowHeight;
  return `M ${fromX} ${fromY} H ${fromX + gap} V ${detourY} H ${toX - gap} V ${toY} H ${toX - 2}`;
}

export type HeaderCell = { key: string; label: string; x: number; width: number; weekend?: boolean; today?: boolean };

/** Two header rows: months on top, then days (day zoom) / weeks (week zoom) / nothing (month zoom). */
export function headerCells(start: Date, days: number, zoom: GanttZoom, pxPerDay: number, today: Date) {
  const top: HeaderCell[] = [];
  const bottom: HeaderCell[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const x = i * pxPerDay;
    if (i === 0 || day.getUTCDate() === 1) {
      top.push({ key: `m-${day.toISOString()}`, label: `${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`, x, width: 0 });
    }
    if (zoom === "day") {
      bottom.push({
        key: `d-${i}`,
        label: String(day.getUTCDate()),
        x,
        width: pxPerDay,
        weekend: day.getUTCDay() === 0 || day.getUTCDay() === 6,
        today: day.getTime() === today.getTime(),
      });
    } else if (zoom === "week" && day.getUTCDay() === 1) {
      bottom.push({ key: `w-${i}`, label: `${String(day.getUTCDate()).padStart(2, "0")}/${String(day.getUTCMonth() + 1).padStart(2, "0")}`, x, width: 7 * pxPerDay });
    }
  }
  for (let i = 0; i < top.length; i++) {
    const nextX = i + 1 < top.length ? top[i + 1].x : days * pxPerDay;
    top[i].width = nextX - top[i].x;
  }
  return { top, bottom };
}

export function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}
