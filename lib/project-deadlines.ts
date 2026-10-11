/** Default "vence em breve" window (days) when the project doesn't set `settings.dueSoonDays`. */
export const DEFAULT_DUE_SOON_DAYS = 2;

const DAY_MS = 86_400_000;

export type DueClassification = { kind: "DUE_SOON"; daysLeft: number } | { kind: "OVERDUE"; daysLate: number } | null;

/**
 * Date-only comparison (both at UTC midnight): overdue when the due date is before today, due soon
 * when it falls within `dueSoonDays` (0 = only "vence hoje").
 */
export function classifyDue(dueDate: Date, today: Date, dueSoonDays: number = DEFAULT_DUE_SOON_DAYS): DueClassification {
  const diff = Math.round((dueDate.getTime() - today.getTime()) / DAY_MS);
  if (diff < 0) return { kind: "OVERDUE", daysLate: -diff };
  if (diff <= dueSoonDays) return { kind: "DUE_SOON", daysLeft: diff };
  return null;
}

/** More than this many new alerts for one person in a single run become one digest notification. */
export const DIGEST_THRESHOLD = 3;
