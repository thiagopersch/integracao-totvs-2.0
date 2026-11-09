/** Payload of each background job type (lib/jobs/handlers.ts). */
export type JobPayloads = {
  /** Sentence backup of one filter (manual or scheduled). `scheduled` re-anchors the filter's nextRunAt when done. */
  "backup.filter": { filterId: string; sentenceCategoryId?: string; userId?: string; scheduled?: boolean };
  /** One demand-report schedule (e-mail per client). */
  "demand-report.run": { scheduleId: string };
  /** One Google Sheets sync. */
  "sheet-sync.run": { syncId: string; trigger: "schedule" | "demand" };
  /** E-mail copies of already-created notifications (the in-app row and SSE push already happened). */
  "notification.email": { notificationIds: string[] };
};

export type JobType = keyof JobPayloads;

export const JOB_TYPES = ["backup.filter", "demand-report.run", "sheet-sync.run", "notification.email"] as const satisfies readonly JobType[];

export function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}

export type JobContext = { jobId: string; organizationId: string; createdById: string | null };
