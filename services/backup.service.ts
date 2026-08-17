import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateBackupInput, UpdateBackupInput } from "@/schemas/backup.schema";
import type { Backup } from "@prisma/client";

class BackupRepository extends BaseRepository<Backup> {
  constructor() {
    super(prisma.backup, ["codeSentence", "nameSentence", "branchSentence"]);
  }
}

export const backupRepository = new BackupRepository();

export const backupService = {
  async list(params: Parameters<typeof backupRepository.findAll>[0]) {
    return backupRepository.findAll(params);
  },

  async createFromFilter(filterId: string) {
    const filter = await prisma.filter.findUnique({
      where: { id: filterId },
      include: { tbc: true },
    });
    if (!filter) throw new Error("Filtro não encontrado");

    return backupRepository.create({
      tbcId: filter.tbcId,
      filterId: filter.id,
      branchSentence: String(filter.branchContext),
      codSystem: filter.codSystemContext,
    } as any);
  },

  async getById(id: string) {
    return backupRepository.findById(id);
  },

  async create(input: CreateBackupInput) {
    return backupRepository.create(input as any);
  },

  async update(id: string, input: UpdateBackupInput) {
    return backupRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return backupRepository.softDelete(id);
  },

  async restore(id: string) {
    return backupRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return backupRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return backupRepository.bulkRestore(ids);
  },
};
