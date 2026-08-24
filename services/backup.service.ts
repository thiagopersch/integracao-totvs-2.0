import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import { fetchSentencesForFilter, restoreSentenceToTbc } from "@/services/rm-sentence.service";
import type { CreateBackupInput, UpdateBackupInput } from "@/schemas/backup.schema";
import type { ListParams } from "@/types/common";
import type { Backup } from "@prisma/client";

class BackupRepository extends BaseRepository<Backup> {
  constructor() {
    super(prisma.backup, ["codeSentence", "nameSentence", "branchSentence"], "backups");
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

  async createFromFilter(
    filterId: string,
    organizationId: string,
    sentenceCategoryId: string | undefined,
    executedByUserId: string
  ) {
    const filter = await prisma.filter.findFirst({
      where: { id: filterId, organizationId },
      include: { tbc: true },
    });
    if (!filter) throw new Error("Filtro não encontrado");

    const backupRun = await prisma.backupRun.create({
      data: { organizationId, filterId, executedByUserId, status: "RUNNING" },
    });

    try {
      const sentences = await fetchSentencesForFilter(filter, organizationId);

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
      throw error;
    }
  },

  async listLatestByFilter(filterId: string, organizationId: string) {
    return prisma.backup.findMany({
      where: { filterId, organizationId, isLatest: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async listHistoryByCode(filterId: string, codeSentence: string, organizationId: string) {
    return prisma.backup.findMany({
      where: { filterId, organizationId, codeSentence, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async listRunsByFilter(filterId: string, params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = { filterId, organizationId };

    const [data, total] = await Promise.all([
      prisma.backupRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
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
