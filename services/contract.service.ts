import { prisma } from "@/lib/prisma";
import { contractUsageService, type ClientMonthlyUsage } from "@/services/contract-usage.service";
import { currentMonth } from "@/lib/contract-usage";
import { findBlockingReferences, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations";
import { assertClientAllowed } from "@/lib/client-access";
import type { CreateContractInput, UpdateContractInput } from "@/schemas/contract.schema";
import type { ListParams } from "@/types/common";
import type { BulkDeleteResult } from "@/repositories/base.repository";

const includeRelations = {
  client: { select: { id: true, name: true, color: true, email: true } },
} as const;

/** Field the contracts table sorts the "Consumo (mês)" column by — computed, so sorted in memory. */
const USAGE_SORT_FIELD = "usagePercent";

type ContractUsage = Pick<ClientMonthlyUsage, "usedHours" | "contractedHours" | "percent" | "level">;

/** Attaches the current month's consumption to every contract in force this month (consumption is
 *  per client, so contracts of the same client share it); other contracts get `usage: null`. */
async function withMonthlyUsage<T extends { id: string; clientId: string }>(organizationId: string, contracts: T[]) {
  const clientIds = [...new Set(contracts.map((c) => c.clientId))];
  const usages = clientIds.length ? await contractUsageService.getMonthlyUsage(organizationId, currentMonth(), clientIds) : [];
  const usageByContractId = new Map<string, ContractUsage>();
  for (const u of usages) {
    for (const contractId of u.contractIds) {
      usageByContractId.set(contractId, {
        usedHours: u.usedHours,
        contractedHours: u.contractedHours,
        percent: u.percent,
        level: u.level,
      });
    }
  }
  return contracts.map((c) => ({ ...c, usage: usageByContractId.get(c.id) ?? null }));
}

export const contractService = {
  async syncExpiredStatuses(organizationId: string, allowedClientIds: string[]) {
    await prisma.clientContract.updateMany({
      where: {
        clientId: { in: allowedClientIds },
        client: { organizationId },
        status: { notIn: ["EXPIRED", "CANCELLED"] },
        endDate: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  },

  async list(params: ListParams, organizationId: string, allowedClientIds: string[]) {
    await this.syncExpiredStatuses(organizationId, allowedClientIds);

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where: Record<string, unknown> = {
      clientId: { in: allowedClientIds },
      client: {
        organizationId,
        ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      },
    };
    if (params.filters?.status) where.status = params.filters.status;

    if (!params.sort || params.sort.field === USAGE_SORT_FIELD) {
      // No explicit column sort: default view groups by hours desc, with expired contracts
      // pushed to the end. Neither that nor the computed usage % is expressible as a Prisma
      // orderBy, so sort in memory.
      const all = await withMonthlyUsage(
        organizationId,
        await prisma.clientContract.findMany({ where, include: includeRelations })
      );
      const usageDirection = params.sort?.direction === "asc" ? 1 : -1;
      const sorted = all.sort((a, b) => {
        if (params.sort) {
          // Contracts without consumption this month always go last, whatever the direction.
          if (!a.usage || !b.usage) return a.usage ? -1 : b.usage ? 1 : 0;
          return (a.usage.percent - b.usage.percent) * usageDirection;
        }
        const aExpired = a.status === "EXPIRED";
        const bExpired = b.status === "EXPIRED";
        if (aExpired !== bExpired) return aExpired ? 1 : -1;
        return b.contractedHours - a.contractedHours;
      });
      const total = sorted.length;
      const data = sorted.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    const orderBy = { [params.sort.field]: params.sort.direction };

    const [rows, total] = await Promise.all([
      prisma.clientContract.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: includeRelations }),
      prisma.clientContract.count({ where }),
    ]);
    const data = await withMonthlyUsage(organizationId, rows);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]) {
    return prisma.clientContract.findFirst({
      where: { id, clientId: { in: allowedClientIds }, client: { organizationId } },
      include: includeRelations,
    });
  },

  async create(input: CreateContractInput, organizationId: string, allowedClientIds: string[]) {
    assertClientAllowed(input.clientId, allowedClientIds);
    const client = await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null } });
    if (!client) throw new Error("Cliente não encontrado");

    const { startDate, endDate, ...rest } = input;
    return prisma.clientContract.create({
      data: { ...rest, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null },
      include: includeRelations,
    });
  },

  async update(id: string, input: UpdateContractInput, organizationId: string, allowedClientIds: string[]) {
    const existing = await prisma.clientContract.findFirst({
      where: { id, clientId: { in: allowedClientIds }, client: { organizationId } },
    });
    if (!existing) throw new Error("Contrato não encontrado");

    const { startDate, endDate, ...rest } = input;
    return prisma.clientContract.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
      include: includeRelations,
    });
  },

  async delete(id: string, organizationId: string, allowedClientIds: string[]) {
    const existing = await prisma.clientContract.findFirst({
      where: { id, clientId: { in: allowedClientIds }, client: { organizationId } },
    });
    if (!existing) throw new Error("Contrato não encontrado");
    const reasons = await findBlockingReferences("ClientContract", id);
    if (reasons.length > 0) {
      throw new Error(`Não é possível excluir: registro em uso em ${formatBlockingReferences(reasons)}.`);
    }
    return prisma.clientContract.delete({ where: { id } });
  },

  async bulkDelete(ids: string[], organizationId: string, allowedClientIds: string[]): Promise<BulkDeleteResult> {
    const owned = await prisma.clientContract.findMany({
      where: { id: { in: ids }, clientId: { in: allowedClientIds }, client: { organizationId } },
      select: { id: true },
    });

    const blocked: { id: string; reasons: BlockingReference[] }[] = [];
    const deletableIds: string[] = [];
    for (const contract of owned) {
      const reasons = await findBlockingReferences("ClientContract", contract.id);
      if (reasons.length > 0) blocked.push({ id: contract.id, reasons });
      else deletableIds.push(contract.id);
    }

    if (deletableIds.length > 0) {
      await prisma.clientContract.deleteMany({ where: { id: { in: deletableIds } } });
    }
    return { deletedCount: deletableIds.length, deletedIds: deletableIds, blocked };
  },
};
