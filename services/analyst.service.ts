import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateAnalystInput, UpdateAnalystInput } from "@/schemas/analyst.schema";
import type { Analyst } from "@/generated/prisma/client";

class AnalystRepository extends BaseRepository<Analyst> {
  constructor() {
    super(prisma.analyst, ["name", "email", "team"], "analysts", "Analyst");
  }
}

export const analystRepository = new AnalystRepository();

async function withContractsCount<T extends { id: string }>(analysts: T[]) {
  if (analysts.length === 0) return analysts.map((a) => ({ ...a, contractsCount: 0 }));

  const clientIds = await prisma.demand.findMany({
    where: { analystId: { in: analysts.map((a) => a.id) }, deletedAt: null },
    select: { analystId: true, clientId: true },
    distinct: ["analystId", "clientId"],
  });

  const contractCountsByClient = await prisma.clientContract.groupBy({
    by: ["clientId"],
    where: { clientId: { in: [...new Set(clientIds.map((c) => c.clientId))] } },
    _count: { id: true },
  });
  const countByClient = new Map(contractCountsByClient.map((c) => [c.clientId, c._count.id]));

  const clientsByAnalyst = new Map<string, Set<string>>();
  for (const { analystId, clientId } of clientIds) {
    if (!clientsByAnalyst.has(analystId)) clientsByAnalyst.set(analystId, new Set());
    clientsByAnalyst.get(analystId)!.add(clientId);
  }

  return analysts.map((a) => ({
    ...a,
    contractsCount: [...(clientsByAnalyst.get(a.id) ?? [])].reduce((sum, clientId) => sum + (countByClient.get(clientId) ?? 0), 0),
  }));
}

export const analystService = {
  async list(params: Parameters<typeof analystRepository.findAll>[0], organizationId: string) {
    const result = await analystRepository.findAll(params, organizationId);
    return { ...result, data: await withContractsCount(result.data) };
  },

  async listAll(organizationId: string) {
    return analystRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return analystRepository.findById(id, organizationId);
  },

  async create(input: CreateAnalystInput, organizationId: string) {
    return analystRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateAnalystInput, organizationId: string) {
    return analystRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return analystRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return analystRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return analystRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return analystRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return analystRepository.bulkRestore(ids, organizationId);
  },
};
