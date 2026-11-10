import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeNextRunAt } from "@/lib/backup-schedule";
import type { JobContext, JobPayloads, JobType } from "@/lib/jobs/types";

/** Jobs run outside the Server Action that queued them, so they expire the caches with revalidateTag. */
function revalidateTags(tags: string[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Outside a Next request scope (in-process scheduler) there is no cache to revalidate.
    }
  }
}

type Handler<T extends JobType> = (payload: JobPayloads[T], ctx: JobContext) => Promise<unknown>;

/**
 * What each job does — thin wrappers over the existing services, so the work is the same whether
 * it runs from QStash, inline (`after()`), or a scheduler. Services are imported lazily to keep the
 * job route's cold start small.
 */
export const JOB_HANDLERS: { [K in JobType]: Handler<K> } = {
  async "backup.filter"(payload, ctx) {
    const { backupService } = await import("@/services/backup.service");
    const { auditService } = await import("@/services/audit.service");
    try {
      // createFromFilter notifies success/failure itself (bell + e-mail).
      const run = await backupService.createFromFilter(payload.filterId, ctx.organizationId, payload.sentenceCategoryId, payload.userId);
      await auditService.log({
        action: "CREATE",
        entity: "BackupRun",
        entityId: run.id,
        organizationId: ctx.organizationId,
        userId: payload.userId,
        newData: { filterId: payload.filterId, scheduled: !!payload.scheduled, jobId: ctx.jobId },
      });
      revalidateTags(["filters", `filter-${payload.filterId}`, `filter-backups-${payload.filterId}`, `filter-backup-runs-${payload.filterId}`]);
      return { backupRunId: run.id };
    } finally {
      if (payload.scheduled) {
        const filter = await prisma.filter.findUnique({ where: { id: payload.filterId }, select: { schedule: true, scheduleTime: true } });
        if (filter) {
          await prisma.filter.update({
            where: { id: payload.filterId },
            data: { nextRunAt: computeNextRunAt(filter.schedule, new Date(), filter.scheduleTime) },
          });
        }
      }
    }
  },

  async "demand-report.run"(payload, ctx) {
    const { demandReportService } = await import("@/services/demand-report.service");
    return demandReportService.run(payload.scheduleId, ctx.organizationId, { manual: false });
  },

  async "sheet-sync.run"(payload, ctx) {
    const { demandSheetSyncService } = await import("@/services/demand-sheet-sync.service");
    return demandSheetSyncService.run(payload.syncId, ctx.organizationId, { trigger: payload.trigger });
  },

  async "notification.email"(payload) {
    const { notificationService } = await import("@/services/notification.service");
    const sent = await notificationService.sendEmails(payload.notificationIds);
    return { sent };
  },
};
