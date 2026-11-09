import { createHash } from "node:crypto";
import { endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { BaseRepository } from "@/repositories/base.repository";
import { auditService, RESTORE_ERROR_ACTION } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import { buildBackupRunFailedNotification, buildBackupRunSucceededNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { formatBackupFilterLabel } from "@/lib/backup-filter-label";
import { fetchSentencesForFilter, restoreSentenceToTbc } from "@/services/rm-sentence.service";
import { soapService, type WsName } from "@/services/soap.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import type { CreateBackupInput, UpdateBackupInput } from "@/schemas/backup.schema";
import type { ListParams } from "@/types/common";
import type { Backup, Prisma } from "@/generated/prisma/client";
import { safeOrderBy } from "@/lib/sort";

class BackupRepository extends BaseRepository<Omit<Backup, "contentSentence">> {
  constructor() {
    super(prisma.backup, ["codeSentence", "nameSentence", "branchSentence"], "backups", "Backup");
  }
}

export const backupRepository = new BackupRepository();

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export type RestoreResult = { count: number; restored: number; failed: { code: string; error: string }[] };

/**
 * Writes each backup row to the target TBC by its exact GConsSql key (CODCOLIGADA + APLICACAO +
 * CODSENTENCA taken from the backup itself) — only codes present in the backup are ever touched.
 * A failing row never stops the rest; each failure is logged as RESTORE_ERROR so it shows up in
 * Rastreamento de Atividades with the consulta and the reason.
 */
async function restoreBackupRows(
  backups: Backup[],
  targetTbcId: string,
  organizationId: string,
  userId: string
): Promise<RestoreResult> {
  const targetTbc = await prisma.tbc.findFirst({
    where: { id: targetTbcId, organizationId, status: true, deletedAt: null },
  });
  if (!targetTbc) throw new Error("TBC de destino não encontrado ou inativo");

  const failed: RestoreResult["failed"] = [];
  let restored = 0;
  for (const backup of backups) {
    try {
      // Never send a partial key — SaveRecord would then match (or create) the wrong consulta.
      if (!backup.codColigada || !backup.codSystem || !backup.codeSentence) {
        throw new Error("Chave incompleta no backup (coligada, aplicação ou código da sentença vazio)");
      }
      await restoreSentenceToTbc(
        targetTbc,
        {
          codeSentence: backup.codeSentence,
          codColigada: backup.codColigada,
          codSystem: backup.codSystem,
          nameSentence: backup.nameSentence || "",
          contentSentence: backup.contentSentence ?? "",
        },
        organizationId
      );
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          restoreStatus: "RESTORED",
          restoredAt: new Date(),
          restoredByUserId: userId,
          restoredToTbcId: targetTbcId,
        },
      });
      restored += 1;
    } catch (error) {
      const code = backup.codeSentence || "(sem código)";
      const message = (error as Error).message;
      failed.push({ code, error: message });
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          restoreStatus: "ERROR",
          restoredAt: new Date(),
          restoredByUserId: userId,
          restoredToTbcId: targetTbcId,
        },
      });
      await auditService.log({
        action: RESTORE_ERROR_ACTION,
        entity: "Backup",
        entityId: backup.id,
        organizationId,
        userId,
        newData: {
          code,
          codColigada: backup.codColigada,
          codSystem: backup.codSystem,
          nameSentence: backup.nameSentence,
          filterId: backup.filterId,
          targetTbcId,
          targetTbcName: targetTbc.name,
          error: message,
        },
      });
    }
  }

  return { count: backups.length, restored, failed };
}

const NO_BACKUP_MESSAGE = "Nenhum backup encontrado para este filtro. Realize um backup antes de restaurar.";

export const backupService = {
  async list(params: Parameters<typeof backupRepository.findAll>[0], organizationId: string) {
    return backupRepository.findAll(params, organizationId);
  },

  /** `executedByUserId` is omitted for scheduler-triggered runs — there's no human behind them. */
  async createFromFilter(
    filterId: string,
    organizationId: string,
    sentenceCategoryId: string | undefined,
    executedByUserId?: string
  ) {
    const filter = await prisma.filter.findFirst({
      where: { id: filterId, organizationId },
      include: { tbc: true, client: { select: { id: true, name: true } } },
    });
    if (!filter) throw new Error("Filtro para backup não encontrado");

    const backupRun = await prisma.backupRun.create({
      data: { organizationId, filterId, executedByUserId, status: "RUNNING" },
    });

    try {
      // Captura o TBC do filtro e autentica (AutenticaAcesso + CheckServiceActivity) antes de
      // qualquer backup — se o TBC estiver inválido/inativo ou o serviço TOTVS indisponível,
      // aborta aqui com uma mensagem clara em vez de gravar um backup potencialmente órfão.
      // O ws folder vem do tipo "dataserver" cadastrado em /admin/soap-endpoints, não hardcoded.
      const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver");
      await soapService.authenticate(
        {
          id: filter.tbc.id,
          name: filter.tbc.name,
          link: filter.tbc.link,
          user: filter.tbc.user,
          password: filter.tbc.password,
          notRequiredLicense: filter.tbc.notRequiredLicense,
          clientId: filter.client.id,
          clientName: filter.client.name,
        },
        dataserverType.suffix as WsName,
        organizationId,
        executedByUserId
      );

      const sentences = await fetchSentencesForFilter(filter, filter.tbc, organizationId);

      // First backup: no prior row exists for any code, so everything is saved as the current
      // version. Subsequent backups: equal hash means unchanged — skip, no new version created;
      // different hash means the new content becomes latest and the previous row is demoted (kept,
      // for that sentence's version history) rather than deleted.
      // Versioned by the full GConsSql key — the same CODSENTENCA can exist under another
      // coligada/aplicação and must not demote (and so drop from restores) that other consulta.
      const keyOf = (s: { codColigada: string | null; codSystem: string | null; codeSentence: string | null }) =>
        `${s.codColigada ?? ""}\u0000${s.codSystem ?? ""}\u0000${s.codeSentence ?? ""}`;

      // One read of the current versions + one demote + batched inserts, instead of 2–3 queries
      // per sentence. When the TBC returns the same key twice, the last occurrence wins (as before).
      const latest = await prisma.backup.findMany({
        where: { filterId, isLatest: true, deletedAt: null },
        select: { id: true, codColigada: true, codSystem: true, codeSentence: true, hash: true },
      });
      const currentByKey = new Map(latest.map((row) => [keyOf(row), row]));
      const incomingByKey = new Map(sentences.map((sentence) => [keyOf(sentence), sentence]));

      const demoteIds: string[] = [];
      const rows: Prisma.BackupCreateManyInput[] = [];
      for (const [key, sentence] of incomingByKey) {
        const hash = hashContent(sentence.contentSentence);
        const current = currentByKey.get(key);
        if (current && current.hash === hash) continue;
        if (current) demoteIds.push(current.id);
        rows.push({
          organizationId,
          tbcId: filter.tbcId,
          filterId,
          backupRunId: backupRun.id,
          sentenceCategoryId,
          branchSentence: String(filter.branchContext),
          codColigada: sentence.codColigada,
          codSystem: sentence.codSystem,
          codeSentence: sentence.codeSentence,
          nameSentence: sentence.nameSentence,
          contentSentence: sentence.contentSentence,
          hash,
          isLatest: true,
          totvsUpdatedAt: sentence.totvsUpdatedAt,
          totvsUpdatedBy: sentence.totvsUpdatedBy,
        });
      }

      if (rows.length > 0) {
        const INSERT_CHUNK = 200;
        await prisma.$transaction(async (tx) => {
          if (demoteIds.length > 0) {
            await tx.backup.updateMany({ where: { id: { in: demoteIds } }, data: { isLatest: false } });
          }
          for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            await tx.backup.createMany({ data: rows.slice(i, i + INSERT_CHUNK) });
          }
        }, { timeout: 60_000 });
      }

      const finishedAt = new Date();
      await prisma.backupRun.update({ where: { id: backupRun.id }, data: { status: "DONE", finishedAt } });
      await prisma.filter.update({
        where: { id: filterId },
        data: { lastBackupStatus: "DONE", lastBackupAt: finishedAt, lastBackupByUserId: executedByUserId },
      });

      // Only the scheduler runs unattended — a manual backup already has the triggering user
      // watching the screen, so notifying them again would just be noise.
      if (!executedByUserId) {
        const notification = buildBackupRunSucceededNotification({
          filterId,
          filterLabel: formatBackupFilterLabel({ clientName: filter.client.name, tbcName: filter.tbc.name, filter: filter.filter }),
          tbcName: filter.tbc.name,
          clientId: filter.client.id,
          clientName: filter.client.name,
        });
        await notificationService.broadcastToOrganization(organizationId, notification);
      }

      return prisma.backupRun.findUniqueOrThrow({ where: { id: backupRun.id } });
    } catch (error) {
      const finishedAt = new Date();
      const errorMessage = (error as Error).message;
      await prisma.backupRun.update({
        where: { id: backupRun.id },
        data: { status: "ERROR", finishedAt, errorMessage },
      });
      await prisma.filter.update({
        where: { id: filterId },
        data: { lastBackupStatus: "ERROR", lastBackupAt: finishedAt, lastBackupByUserId: executedByUserId },
      });

      const notification = buildBackupRunFailedNotification({
        filterId,
        filterLabel: formatBackupFilterLabel({ clientName: filter.client.name, tbcName: filter.tbc.name, filter: filter.filter }),
        tbcName: filter.tbc.name,
        errorMessage,
        clientId: filter.client.id,
        clientName: filter.client.name,
        errorKind: classifyError(error),
      });
      await notificationService.broadcastToOrganization(organizationId, notification, executedByUserId);

      throw error;
    }
  },

  /**
   * Scheduler tick (`/api/cron/backup`, or the in-process poller with RUN_INPROCESS_SCHEDULERS):
   * enqueues one "backup.filter" job per due filter — QStash runs them with bounded parallelism and
   * the job re-anchors the filter's nextRunAt when it finishes. A Redis lock keeps overlapping ticks
   * (several instances, a slow tick) from enqueuing twice, and the job dedupe id covers the rest.
   */
  async runDueScheduledBackups() {
    const { withLock } = await import("@/lib/locks");
    const { enqueue } = await import("@/lib/jobs");
    const outcome = await withLock("scheduler:backup", 55_000, async () => {
      const due = await prisma.filter.findMany({
        where: { deletedAt: null, status: true, schedule: { not: "NONE" }, nextRunAt: { lte: new Date() } },
        select: { id: true, organizationId: true, scheduleCategoryId: true, nextRunAt: true },
      });
      let enqueued = 0;
      for (const filter of due) {
        try {
          const { deduped } = await enqueue(
            "backup.filter",
            { filterId: filter.id, sentenceCategoryId: filter.scheduleCategoryId ?? undefined, scheduled: true },
            { organizationId: filter.organizationId, dedupeId: `backup:${filter.id}:${filter.nextRunAt?.getTime() ?? 0}` }
          );
          if (!deduped) enqueued++;
        } catch (error) {
          logger.error(`Falha ao enfileirar o backup agendado do filtro ${filter.id}`, { error: (error as Error).message });
        }
      }
      return enqueued;
    });
    return outcome.skipped ? { processed: 0, skipped: "locked" as const } : { processed: outcome.value };
  },

  async listLatestByFilter(filterId: string, params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const f = params.filters ?? {};
    const where: Prisma.BackupWhereInput = { filterId, organizationId, isLatest: true, deletedAt: null };
    if (f.codColigada) where.codColigada = f.codColigada as string;
    if (f.codSystem) where.codSystem = f.codSystem as string;
    if (f.dateFrom || f.dateTo) {
      where.createdAt = {
        ...(f.dateFrom ? { gte: new Date(f.dateFrom as string) } : {}),
        ...(f.dateTo ? { lte: endOfDay(new Date(f.dateTo as string)) } : {}),
      };
    }
    if (params.search) {
      where.OR = ["codeSentence", "codColigada", "codSystem", "nameSentence"].map((field) => ({
        [field]: { contains: params.search, mode: "insensitive" as const },
      }));
    }
    const orderBy = params.sort
      ? safeOrderBy(params.sort)
      : { codeSentence: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.backup.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        omit: { contentSentence: false },
      }),
      prisma.backup.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async listHistoryByCode(filterId: string, codeSentence: string, organizationId: string) {
    return prisma.backup.findMany({
      where: { filterId, organizationId, codeSentence, deletedAt: null },
      orderBy: { createdAt: "desc" },
      omit: { contentSentence: false },
    });
  },

  /** Always re-reads from the app DB at click time — "Visualizar" must never trust an in-memory
   *  row that may have gone stale if a newer backup ran since the page loaded. */
  async getLatestByCode(filterId: string, codeSentence: string, organizationId: string) {
    return prisma.backup.findFirst({
      where: { filterId, organizationId, codeSentence, isLatest: true, deletedAt: null },
      omit: { contentSentence: false },
    });
  },

  async listRunsByFilter(filterId: string, params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = { filterId, organizationId };
    const orderBy = params.sort ? safeOrderBy(params.sort) : { startedAt: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.backupRun.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.backupRun.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async listByRun(backupRunId: string, organizationId: string) {
    return prisma.backup.findMany({
      where: { backupRunId, organizationId, deletedAt: null },
      orderBy: { codeSentence: "asc" },
      omit: { contentSentence: false },
    });
  },

  async restoreLatestForFilter(filterId: string, targetTbcId: string, organizationId: string, userId: string) {
    const backups = await prisma.backup.findMany({
      where: { filterId, organizationId, isLatest: true, deletedAt: null },
      omit: { contentSentence: false },
    });
    if (backups.length === 0) throw new Error(NO_BACKUP_MESSAGE);
    return restoreBackupRows(backups, targetTbcId, organizationId, userId);
  },

  async restoreForRun(backupRunId: string, targetTbcId: string, organizationId: string, userId: string) {
    const backups = await prisma.backup.findMany({
      where: { backupRunId, organizationId, deletedAt: null },
      omit: { contentSentence: false },
    });
    if (backups.length === 0) throw new Error("Nenhuma sentença encontrada nesta execução de backup.");
    return restoreBackupRows(backups, targetTbcId, organizationId, userId);
  },

  async restoreSingle(backupId: string, targetTbcId: string, organizationId: string, userId: string) {
    const backup = await prisma.backup.findFirst({ where: { id: backupId, organizationId }, omit: { contentSentence: false } });
    if (!backup) throw new Error("Backup não encontrado");
    return restoreBackupRows([backup], targetTbcId, organizationId, userId);
  },

  async getById(id: string, organizationId: string) {
    return backupRepository.findById(id, organizationId);
  },

  async create(input: CreateBackupInput, organizationId: string) {
    return backupRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateBackupInput, organizationId: string) {
    return backupRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return backupRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return backupRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return backupRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return backupRepository.bulkRestore(ids, organizationId);
  },
};
