import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateBackupInput, UpdateBackupInput } from "@/schemas/backup.schema";
import type { Backup } from "@prisma/client";

class BackupRepository extends BaseRepository<Backup> {
  constructor() {
    super(prisma.backup, ["codeSentence", "nameSentence", "branchSentence"], "backups");
  }
}

export const backupRepository = new BackupRepository();

export const backupService = {
  async list(params: Parameters<typeof backupRepository.findAll>[0], organizationId: string) {
    return backupRepository.findAll(params, organizationId);
  },

  async createFromFilter(filterId: string, organizationId: string) {
    const filter = await prisma.filter.findFirst({
      where: { id: filterId, organizationId },
      include: { tbc: true },
    });
    if (!filter) throw new Error("Filtro não encontrado");

    return backupRepository.create({
      organizationId,
      tbcId: filter.tbcId,
      filterId: filter.id,
      branchSentence: String(filter.branchContext),
      codSystem: filter.codSystemContext,
    } as any);
  },

  async getById(id: string, organizationId: string) {
    return backupRepository.findById(id, organizationId);
  },

  async create(input: CreateBackupInput, organizationId: string) {
    return backupRepository.create({ ...input, organizationId } as any);
  },

  async update(id: string, input: UpdateBackupInput, organizationId: string) {
    return backupRepository.update(id, input as any, organizationId);
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
