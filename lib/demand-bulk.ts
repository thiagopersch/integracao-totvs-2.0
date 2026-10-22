/**
 * Bulk edit of demands: each list field is applied per demand as add / replace / remove, and the
 * times are completed from the demand itself so a partial change keeps the duration consistent.
 * Pure so the server action and the tests share the same rules.
 */

export type BulkListMode = "add" | "replace" | "remove";
export type BulkListChange = { mode: BulkListMode; ids: string[] };

/** The demand's list after the change; `undefined` change = keep it as-is. */
export function applyListChange(current: string[], change: BulkListChange | undefined): string[] {
  if (!change) return current;
  if (change.mode === "replace") return [...new Set(change.ids)];
  if (change.mode === "add") return [...new Set([...current, ...change.ids])];
  const removed = new Set(change.ids);
  return current.filter((id) => !removed.has(id));
}

/** "HH:mm" of a stored time (times are kept as UTC wall-clock values). */
export function toTimeValue(date: Date | null): string | undefined {
  if (!date) return undefined;
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Date/time fields to send for one demand. Changing one time sends the other from the demand (so the
 * duration is recomputed); changing the date sends both times so they move to the new day.
 */
export function resolveBulkSchedule(
  existing: { startTime: Date | null; endTime: Date | null },
  change: { date?: string; startTime?: string; endTime?: string },
): { date?: string; startTime?: string; endTime?: string } {
  if (!change.date && !change.startTime && !change.endTime) return {};
  return {
    ...(change.date ? { date: change.date } : {}),
    startTime: change.startTime ?? toTimeValue(existing.startTime),
    endTime: change.endTime ?? toTimeValue(existing.endTime),
  };
}
