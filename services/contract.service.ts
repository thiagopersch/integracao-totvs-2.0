import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { contractUsageService, type ClientMonthlyUsage } from "@/services/contract-usage.service";
import { currentMonth, periodKey, round2 } from "@/lib/contract-usage";
import { periodToDateRange } from "@/lib/period";
import { findBlockingReferences, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations";
import { assertClientAllowed } from "@/lib/client-access";
import { getContractAnalystExcess } from "@/services/analyst-dashboard.service";
import type { AddExtraHoursInput, CreateContractInput, UpdateContractInput } from "@/schemas/contract.schema";
import type { ListParams } from "@/types/common";
import type { BulkDeleteResult } from "@/repositories/base.repository";
import { safeOrderBy } from "@/lib/sort";

const includeRelations = {
  client: { select: { id: true, name: true, color: true, email: true } },
  contractAnalysts: {
    select: { analyst: { select: { id: true, name: true, color: true, hourlyRate: true, excessHourlyRate: true } } },
  },
  projects: { select: { id: true } },
} as const;

/** Field the contracts table sorts the "Consumo (mês)" column by — computed, so sorted in memory. */
const USAGE_SORT_FIELD = "usagePercent";

type ContractUsage = Pick<
  ClientMonthlyUsage,
  "usedHours" | "demandHours" | "projectHours" | "contractedHours" | "baseHours" | "extraHours" | "percent" | "level"
>;

type Month = { year: number; month: number };

/** Extra hours and analyst links are part of the contract (deleted with it), so they never block its deletion. */
const DELETE_IGNORED_MODELS = ["ContractExtraHours", "ContractAnalyst"];

/** Nested write for the contract's analysts. `replace` (update) swaps the whole list; create only
 *  adds. `undefined` leaves existing links untouched (e.g. a partial update that omits the field). */
function contractAnalystLinks(analystIds: string[] | undefined, replace = false) {
  if (analystIds === undefined) return undefined;
  const unique = [...new Set(analystIds.filter(Boolean))];
  return { ...(replace ? { deleteMany: {} } : {}), create: unique.map((analystId) => ({ analystId })) };
}

/** Attaches `month`'s consumption to every contract in force that month (consumption is per client,
 *  so contracts of the same client share it — and demands launched before the contract existed still
 *  count, since usage is the client's demand time in the month); other contracts get `usage: null`. */
async function withMonthlyUsage<T extends { id: string; clientId: string }>(organizationId: string, contracts: T[], month: Month) {
  const clientIds = [...new Set(contracts.map((c) => c.clientId))];
  const [usages, extras] = clientIds.length
    ? await Promise.all([
        contractUsageService.getMonthlyUsage(organizationId, month, clientIds),
        prisma.contractExtraHours.groupBy({
          by: ["contractId"],
          where: { contractId: { in: contracts.map((c) => c.id) }, period: periodKey(month) },
          _sum: { hours: true },
        }),
      ])
    : [[], []];
  const extraByContractId = new Map(extras.map((e) => [e.contractId, e._sum.hours ?? 0]));
  const usageByContractId = new Map<string, ContractUsage>();
  for (const u of usages) {
    for (const contractId of u.contractIds) {
      usageByContractId.set(contractId, {
        usedHours: u.usedHours,
        demandHours: u.demandHours,
        projectHours: u.projectHours,
        contractedHours: u.contractedHours,
        baseHours: u.baseHours,
        extraHours: u.extraHours,
        percent: u.percent,
        level: u.level,
      });
    }
  }
  // `monthExtraHours`: this contract's own extras in the month (usage.extraHours is per client).
  return contracts.map((c) => ({ ...c, monthExtraHours: extraByContractId.get(c.id) ?? 0, usage: usageByContractId.get(c.id) ?? null }));
}

type ContractAnalystLink = Prisma.ClientContractGetPayload<{ include: typeof includeRelations }>["contractAnalysts"][number];
type ContractAnalystValue = { normal: number; excess: number; total: number };

/** Attaches, per analyst linked to the contract, how much the contract would be worth at that
 *  analyst's rate — `value.normal` is the contract's full allowance (contracted + this month's
 *  extra hours) at the analyst's `hourlyRate`, regardless of how much they actually worked; this is
 *  intentionally NOT the real-work-based billing shown in the "Analistas" dashboard tab. `value.excess`
 *  only applies when the analyst has an `excessHourlyRate` set — otherwise it's left at 0, even if
 *  that analyst does have excess hours — priced on their prorated share of the contract's real
 *  excess hours that month (same proration as the dashboard, via `getContractAnalystExcess`). */
async function withAnalystValues<
  T extends { id: string; clientId: string; contractedHours: number; monthExtraHours: number; contractAnalysts: ContractAnalystLink[]; projects: { id: string }[] },
>(organizationId: string, contracts: T[], month: Month) {
  const range = periodToDateRange(month)!;
  return Promise.all(
    contracts.map(async (c) => {
      const { contractAnalysts: links, ...rest } = c;
      if (links.length === 0) {
        return { ...rest, contractAnalysts: [] as (ContractAnalystLink & { value: ContractAnalystValue })[] };
      }
      const excessByAnalyst = await getContractAnalystExcess(
        organizationId,
        {
          id: c.id,
          clientId: c.clientId,
          contractedHours: c.contractedHours,
          extraHours: [{ hours: c.monthExtraHours }],
          contractAnalysts: links.map((ca) => ({ analystId: ca.analyst.id })),
          projects: c.projects,
        },
        range
      );
      const allowance = round2(c.contractedHours + c.monthExtraHours);
      const contractAnalysts = links.map((ca) => {
        const excessHours = excessByAnalyst.get(ca.analyst.id)?.excessHours ?? 0;
        const normal = round2(allowance * (ca.analyst.hourlyRate ?? 0));
        const excess = ca.analyst.excessHourlyRate != null ? round2(excessHours * ca.analyst.excessHourlyRate) : 0;
        return { ...ca, value: { normal, excess, total: round2(normal + excess) } satisfies ContractAnalystValue };
      });
      return { ...rest, contractAnalysts };
    })
  );
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

  async list(params: ListParams, organizationId: string, allowedClientIds: string[], month: Month = currentMonth()) {
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
        await prisma.clientContract.findMany({ where, include: includeRelations }),
        month
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
      const page1 = sorted.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      const data = await withAnalystValues(organizationId, page1, month);
      return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    }

    const orderBy = safeOrderBy(params.sort);

    const [rows, total] = await Promise.all([
      prisma.clientContract.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: includeRelations }),
      prisma.clientContract.count({ where }),
    ]);
    const data = await withAnalystValues(organizationId, await withMonthlyUsage(organizationId, rows, month), month);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[], month: Month = currentMonth()) {
    const contract = await prisma.clientContract.findFirst({
      where: { id, clientId: { in: allowedClientIds }, client: { organizationId } },
      include: includeRelations,
    });
    if (!contract) return null;
    const [withUsage] = await withMonthlyUsage(organizationId, [contract], month);
    const [withValues] = await withAnalystValues(organizationId, [withUsage], month);
    return withValues;
  },

  async create(input: CreateContractInput, organizationId: string, allowedClientIds: string[]) {
    assertClientAllowed(input.clientId, allowedClientIds);
    const client = await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null } });
    if (!client) throw new Error("Cliente não encontrado");

    const { startDate, endDate, analystIds, ...rest } = input;
    return prisma.clientContract.create({
      data: {
        ...rest,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        contractAnalysts: contractAnalystLinks(analystIds),
      },
      include: includeRelations,
    });
  },

  async update(id: string, input: UpdateContractInput, organizationId: string, allowedClientIds: string[]) {
    const existing = await prisma.clientContract.findFirst({
      where: { id, clientId: { in: allowedClientIds }, client: { organizationId } },
    });
    if (!existing) throw new Error("Contrato não encontrado");

    const { startDate, endDate, analystIds, ...rest } = input;
    // Clearing the end date removes the reason for expiration, so an expired contract goes back to active.
    const endDateCleared = existing.endDate !== null && endDate !== undefined && !endDate;
    if (endDateCleared && (rest.status ?? existing.status) === "EXPIRED") rest.status = "ACTIVE";
    return prisma.clientContract.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        contractAnalysts: contractAnalystLinks(analystIds, true),
      },
      include: includeRelations,
    });
  },

  async delete(id: string, organizationId: string, allowedClientIds: string[]) {
    const existing = await prisma.clientContract.findFirst({
      where: { id, clientId: { in: allowedClientIds }, client: { organizationId } },
    });
    if (!existing) throw new Error("Contrato não encontrado");
    const reasons = await findBlockingReferences("ClientContract", id, { ignoreModels: DELETE_IGNORED_MODELS });
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
      const reasons = await findBlockingReferences("ClientContract", contract.id, { ignoreModels: DELETE_IGNORED_MODELS });
      if (reasons.length > 0) blocked.push({ id: contract.id, reasons });
      else deletableIds.push(contract.id);
    }

    if (deletableIds.length > 0) {
      await prisma.clientContract.deleteMany({ where: { id: { in: deletableIds } } });
    }
    return { deletedCount: deletableIds.length, deletedIds: deletableIds, blocked };
  },

  /** Extra hours launched for the contract in `period` ("2026-10"), newest first. */
  async listExtraHours(contractId: string, period: string, organizationId: string, allowedClientIds: string[]) {
    return prisma.contractExtraHours.findMany({
      where: { contractId, period, contract: { clientId: { in: allowedClientIds }, client: { organizationId } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, period: true, hours: true, notes: true, createdAt: true },
    });
  },

  async addExtraHours(input: AddExtraHoursInput, userId: string, organizationId: string, allowedClientIds: string[]) {
    const contract = await prisma.clientContract.findFirst({
      where: { id: input.contractId, clientId: { in: allowedClientIds }, client: { organizationId } },
      select: { id: true, clientId: true, client: { select: { name: true } } },
    });
    if (!contract) throw new Error("Contrato não encontrado");
    const entry = await prisma.contractExtraHours.create({
      data: { contractId: contract.id, period: input.period, hours: input.hours, notes: input.notes || null, createdById: userId },
    });
    return { entry, contract };
  },

  async deleteExtraHours(id: string, organizationId: string, allowedClientIds: string[]) {
    const entry = await prisma.contractExtraHours.findFirst({
      where: { id, contract: { clientId: { in: allowedClientIds }, client: { organizationId } } },
      include: { contract: { select: { clientId: true, client: { select: { name: true } } } } },
    });
    if (!entry) throw new Error("Lançamento de horas extras não encontrado");
    await prisma.contractExtraHours.delete({ where: { id } });
    return entry;
  },
};
