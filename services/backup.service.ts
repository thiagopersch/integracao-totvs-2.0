import { createHash } from "node:crypto";
import { endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { BaseRepository } from "@/repositories/base.repository";
import { computeNextRunAt } from "@/lib/backup-schedule";
import { auditService } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import { buildBackupRunFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { fetchSentencesForFilter, restoreSentenceToTbc } from "@/services/rm-sentence.service";
import { soapService, type WsName } from "@/services/soap.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import type { CreateBackupInput, UpdateBackupInput } from "@/schemas/backup.schema";
import type { ListParams } from "@/types/common";
import type { Backup, Prisma } from "@/generated/prisma/client";

class BackupRepository extends BaseRepository<Backup> {
  constructor() {
    super(prisma.backup, ["codeSentence", "nameSentence", "branchSentence"], "backups", "Backup");
  }
}

export const backupRepository = new BackupRepository();

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function restoreBackupRows(backups: Backup[], targetTbcId: string, organizationId: string, userId: string) {
  const targetTbc = await prisma.tbc.findFirst({
    where: { id: targetTbcId, organizationId, status: true, deletedAt: null },
  });
  if (!targetTbc) throw new Error("TBC de destino não encontrado ou inativo");

  let failures = 0;
  for (const backup of backups) {
    try {
      await restoreSentenceToTbc(
        targetTbc,
        {
          codeSentence: backup.codeSentence || "",
          codColigada: backup.codColigada || "",
          codSystem: backup.codSystem || "",
          nameSentence: backup.nameSentence || "",
          contentSentence: backup.contentSentence || "",
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
    } catch {
      failures += 1;
      await prisma.backup.update({
        where: { id: backup.id },
        data: {
          restoreStatus: "ERROR",
          restoredAt: new Date(),
          restoredByUserId: userId,
          restoredToTbcId: targetTbcId,
        },
      });
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} de ${backups.length} sentença(s) falharam ao restaurar`);
  }
  return { count: backups.length };
}

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
    if (!filter) throw new Error("Filtro não encontrado");

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
      for (const sentence of sentences) {
        const hash = hashContent(sentence.contentSentence);
        const current = await prisma.backup.findFirst({
          where: { filterId, codeSentence: sentence.codeSentence, isLatest: true, deletedAt: null },
        });

        if (current && current.hash === hash) continue;

        if (current) {
          await prisma.backup.update({ where: { id: current.id }, data: { isLatest: false } });
        }

        await prisma.backup.create({
          data: {
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
          },
        });
      }

      const finishedAt = new Date();
      await prisma.backupRun.update({ where: { id: backupRun.id }, data: { status: "DONE", finishedAt } });
      await prisma.filter.update({
        where: { id: filterId },
        data: { lastBackupStatus: "DONE", lastBackupAt: finishedAt, lastBackupByUserId: executedByUserId },
      });

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
        filterLabel: filter.filter,
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
   * Polled by the in-process scheduler (see lib/backup-scheduler.ts) — runs every filter whose
   * `nextRunAt` has passed, then re-anchors `nextRunAt` from "now" regardless of success/failure
   * (a filter stuck failing every run must not fire in a tight retry loop).
   */
  async runDueScheduledBackups() {
    const due = await prisma.filter.findMany({
      where: {
        deletedAt: null,
        status: true,
        schedule: { not: "NONE" },
        nextRunAt: { lte: new Date() },
      },
      select: { id: true, organizationId: true, schedule: true, scheduleTime: true, scheduleCategoryId: true },
    });

    for (const filter of due) {
      try {
        await this.createFromFilter(filter.id, filter.organizationId, filter.scheduleCategoryId ?? undefined, undefined);
        await auditService.log({
          action: "CREATE",
          entity: "BackupRun",
          entityId: filter.id,
          organizationId: filter.organizationId,
        });
      } catch (error) {
        logger.error(`Backup agendado falhou para o filtro ${filter.id}`, { error: (error as Error).message });
      } finally {
        const nextRunAt = computeNextRunAt(filter.schedule, new Date(), filter.scheduleTime);
        await prisma.filter.update({ where: { id: filter.id }, data: { nextRunAt } });
      }
    }

    return { processed: due.length };
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
      ? { [params.sort.field]: params.sort.direction }
      : { codeSentence: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.backup.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.backup.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async listHistoryByCode(filterId: string, codeSentence: string, organizationId: string) {
    return prisma.backup.findMany({
      where: { filterId, organizationId, codeSentence, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Always re-reads from the app DB at click time — "Visualizar" must never trust an in-memory
   *  row that may have gone stale if a newer backup ran since the page loaded. */
  async getLatestByCode(filterId: string, codeSentence: string, organizationId: string) {
    return prisma.backup.findFirst({
      where: { filterId, organizationId, codeSentence, isLatest: true, deletedAt: null },
    });
  },

  async listRunsByFilter(filterId: string, params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = { filterId, organizationId };
    const orderBy = params.sort ? { [params.sort.field]: params.sort.direction } : { startedAt: "desc" as const };

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
    });
  },

  async restoreLatestForFilter(filterId: string, targetTbcId: string, organizationId: string, userId: string) {
    const backups = await prisma.backup.findMany({
      where: { filterId, organizationId, isLatest: true, deletedAt: null },
    });
    return restoreBackupRows(backups, targetTbcId, organizationId, userId);
  },

  async restoreForRun(backupRunId: string, targetTbcId: string, organizationId: string, userId: string) {
    const backups = await prisma.backup.findMany({
      where: { backupRunId, organizationId, deletedAt: null },
    });
    return restoreBackupRows(backups, targetTbcId, organizationId, userId);
  },

  async restoreSingle(backupId: string, targetTbcId: string, organizationId: string, userId: string) {
    const backup = await prisma.backup.findFirst({ where: { id: backupId, organizationId } });
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
