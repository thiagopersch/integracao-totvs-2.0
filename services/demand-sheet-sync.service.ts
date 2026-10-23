import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { toExportRow, type DemandForExport } from "@/lib/export-mappers";
import { GoogleSheetsError, parseSpreadsheetId } from "@/lib/google-sheets";
import type { TimesheetRow } from "@/lib/sheet-timesheet";
import { buildSheetSyncFailedNotification } from "@/lib/notification-types";
import type { ErrorKind } from "@/lib/error-kind";
import { resolveReportPeriod } from "@/lib/report-period";
import { computeNextReportRunAt } from "@/lib/report-schedule";
import { auditService } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import { googleSettingsService } from "@/services/google-settings.service";
import { demandIncludeRelations } from "@/services/demand.service";
import type { DemandSheetSyncInput } from "@/schemas/demand-sheet-sync.schema";
import type { BackupSchedule } from "@/generated/prisma/client";

const SCHEDULER_LOCK = "demand-sheet-sync";
/** A demand change waits this long, so a burst of edits (or an import) ends in a single sync. */
const DEBOUNCE_MS = 2 * 60_000;

type SyncRecord = NonNullable<Awaited<ReturnType<typeof prisma.demandSheetSync.findFirst>>>;

/** What started a run: "Sincronizar agora", the registered frequency, or a demand change. */
export type SheetSyncTrigger = "manual" | "schedule" | "demand";

export interface SheetSyncResult {
  status: "SUCCESS" | "FAILED";
  message: string;
}

function timesheetRow(d: DemandForExport): TimesheetRow {
  const row = toExportRow(d);
  return {
    date: d.date,
    analyst: row["Nome do analista"],
    hours: row["Horas executadas"],
    name: row["Nome da demanda"],
    description: row["Descrição da demanda"],
    requester: row.Solicitante,
    department: row.Setor,
    client: row.Cliente,
  };
}

function toData(input: DemandSheetSyncInput) {
  return {
    name: input.name,
    spreadsheetUrl: input.spreadsheetUrl,
    spreadsheetId: parseSpreadsheetId(input.spreadsheetUrl)!,
    period: input.period,
    clientIds: input.clientIds,
    analystIds: input.analystIds,
    schedule: input.schedule as BackupSchedule,
    scheduleTime: input.schedule === "NONE" ? null : input.scheduleTime,
    dayOfMonth: input.schedule === "MONTHLY" ? input.dayOfMonth : null,
    syncOnDemandChange: input.syncOnDemandChange,
    isActive: input.isActive,
    nextRunAt:
      input.isActive && input.schedule !== "NONE"
        ? computeNextReportRunAt(input.schedule as BackupSchedule, new Date(), input.scheduleTime, input.dayOfMonth)
        : null,
  };
}

function errorKindOf(error: unknown): ErrorKind {
  const status = error instanceof GoogleSheetsError ? error.status : undefined;
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status && status >= 400) return "http";
  return "unknown";
}

export const demandSheetSyncService = {
  async list(organizationId: string) {
    return prisma.demandSheetSync.findMany({ where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } });
  },

  async getById(id: string, organizationId: string) {
    return prisma.demandSheetSync.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  /** Analysts of a timesheet sync must belong to the organization. */
  async assertAnalysts(analystIds: string[], organizationId: string) {
    if (analystIds.length === 0) return;
    const found = await prisma.analyst.count({ where: { organizationId, id: { in: analystIds } } });
    if (found !== new Set(analystIds).size) throw new Error("Analista não encontrado");
  },

  async create(input: DemandSheetSyncInput, organizationId: string) {
    await this.assertAnalysts(input.analystIds, organizationId);
    return prisma.demandSheetSync.create({ data: { ...toData(input), organizationId } });
  },

  async update(id: string, input: DemandSheetSyncInput, organizationId: string) {
    if (!(await this.getById(id, organizationId))) throw new Error("Planilha não encontrada");
    await this.assertAnalysts(input.analystIds, organizationId);
    return prisma.demandSheetSync.update({ where: { id }, data: toData(input) });
  },

  async setActive(id: string, isActive: boolean, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) throw new Error("Planilha não encontrada");
    const nextRunAt =
      isActive && existing.schedule !== "NONE"
        ? computeNextReportRunAt(existing.schedule, new Date(), existing.scheduleTime, existing.dayOfMonth)
        : null;
    return prisma.demandSheetSync.update({ where: { id }, data: { isActive, nextRunAt, pendingSyncAt: null } });
  },

  async remove(id: string, organizationId: string) {
    if (!(await this.getById(id, organizationId))) throw new Error("Planilha não encontrada");
    await prisma.demandSheetSync.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, nextRunAt: null, pendingSyncAt: null },
    });
  },

  /**
   * The period's demands (of the selected clients/analysts) in date order, for the month tab
   * ("Outubro26") of the period — lib/sheet-timesheet.ts. Syncs saved with a non-month period
   * (before the month tab layout) fill the current month.
   */
  async buildTimesheet(sync: Pick<SyncRecord, "organizationId" | "clientIds" | "analystIds" | "period">, now: Date) {
    const period = resolveReportPeriod(sync.period === "previousMonth" ? "previousMonth" : "currentMonth", now);
    const demands = await prisma.demand.findMany({
      where: {
        organizationId: sync.organizationId,
        deletedAt: null,
        date: { gte: period.gte, lt: period.lt },
        ...(sync.clientIds.length ? { clientId: { in: sync.clientIds } } : {}),
        ...(sync.analystIds.length ? { demandAnalysts: { some: { analystId: { in: sync.analystIds } } } } : {}),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
      include: demandIncludeRelations,
    });
    return {
      period,
      sheet: {
        month: { year: period.gte.getUTCFullYear(), month: period.gte.getUTCMonth() + 1 },
        periodLabel: `${period.startLabel} a ${period.endLabel}`,
        rows: demands.map(timesheetRow),
      },
    };
  },

  /**
   * Fills the month tab of the spreadsheet. Records the outcome; scheduled runs re-anchor `nextRunAt` (even on
   * failure, so a broken sync never fires in a tight loop) and every run clears `pendingSyncAt`.
   * An automatic failure notifies the organization only when the previous run did not fail already.
   */
  async run(id: string, organizationId: string, options: { trigger: SheetSyncTrigger; userId?: string; now?: Date }): Promise<SheetSyncResult> {
    const sync = await this.getById(id, organizationId);
    if (!sync) throw new Error("Planilha não encontrada");
    const now = options.now ?? new Date();

    let result: SheetSyncResult;
    let failure: unknown = null;
    try {
      const { client } = await googleSettingsService.getClient(organizationId);
      const { period, sheet } = await this.buildTimesheet(sync, now);
      const { tabTitle, created } = await client.writeMonthlyTimesheet(sync.spreadsheetId, sheet);
      result = {
        status: "SUCCESS",
        message: `${sheet.rows.length} demanda(s) na aba ${tabTitle}${created ? " (criada)" : ""} — ${period.label}`,
      };
    } catch (error) {
      failure = error;
      result = { status: "FAILED", message: (error as Error).message };
    }

    await prisma.demandSheetSync.update({
      where: { id },
      data: {
        lastRunAt: now,
        lastRunStatus: result.status,
        lastRunMessage: result.message,
        pendingSyncAt: null,
        ...(options.trigger === "schedule"
          ? {
              nextRunAt:
                sync.isActive && sync.schedule !== "NONE"
                  ? computeNextReportRunAt(sync.schedule, now, sync.scheduleTime, sync.dayOfMonth)
                  : null,
            }
          : {}),
      },
    });
    await auditService.log({
      action: "SYNC_SHEET",
      entity: "DemandSheetSync",
      entityId: id,
      organizationId,
      userId: options.userId,
      newData: { name: sync.name, trigger: options.trigger, ...result },
    });
    if (failure && options.trigger !== "manual" && sync.lastRunStatus !== "FAILED") {
      const clientName =
        sync.clientIds.length === 1
          ? (await prisma.client.findUnique({ where: { id: sync.clientIds[0] }, select: { name: true } }))?.name
          : undefined;
      await notificationService.broadcastToOrganization(
        organizationId,
        buildSheetSyncFailedNotification({
          syncName: sync.name,
          errorMessage: result.message,
          errorKind: errorKindOf(failure),
          url: sync.spreadsheetUrl,
          clientId: sync.clientIds.length === 1 ? sync.clientIds[0] : undefined,
          clientName,
        })
      );
    }
    return result;
  },

  /**
   * Called after demands change (create/edit/duplicate/import/delete): pushes `pendingSyncAt` of
   * the active syncs covering those clients, after the response is sent. Pass `demandIds` when the
   * clients are not at hand (soft-deleted demands still carry their client).
   */
  scheduleDemandsChanged(organizationId: string, target: { clientIds?: string[]; demandIds?: string[] }) {
    after(async () => {
      try {
        const fromDemands = target.demandIds?.length
          ? await prisma.demand.findMany({ where: { organizationId, id: { in: target.demandIds } }, select: { clientId: true } })
          : [];
        const clientIds = [...new Set([...(target.clientIds ?? []), ...fromDemands.map((d) => d.clientId)])];
        if (clientIds.length === 0) return;
        await prisma.demandSheetSync.updateMany({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
            syncOnDemandChange: true,
            OR: [{ clientIds: { isEmpty: true } }, { clientIds: { hasSome: clientIds } }],
          },
          data: { pendingSyncAt: new Date(Date.now() + DEBOUNCE_MS) },
        });
      } catch (error) {
        logger.error("Falha ao agendar a atualização das planilhas Google", { error: (error as Error).message });
      }
    });
  },

  /** Scheduler tick (lib/demand-sheet-sync-scheduler.ts): due schedules and debounced demand changes. */
  async runDue() {
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${SCHEDULER_LOCK})::bigint) AS locked
    `;
    if (!locked) return { processed: 0 };
    try {
      const now = new Date();
      const due = await prisma.demandSheetSync.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          OR: [{ schedule: { not: "NONE" }, nextRunAt: { lte: now } }, { pendingSyncAt: { lte: now } }],
        },
        select: { id: true, organizationId: true, nextRunAt: true, schedule: true },
      });
      for (const sync of due) {
        try {
          // Only a due schedule re-anchors nextRunAt; a demand-change sync leaves it as it is.
          const scheduled = sync.schedule !== "NONE" && !!sync.nextRunAt && sync.nextRunAt <= now;
          await this.run(sync.id, sync.organizationId, { trigger: scheduled ? "schedule" : "demand" });
        } catch (error) {
          logger.error("Falha na atualização da planilha Google", { syncId: sync.id, error: (error as Error).message });
        }
      }
      return { processed: due.length };
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${SCHEDULER_LOCK})::bigint)`;
    }
  },
};
