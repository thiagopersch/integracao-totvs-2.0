import { prisma } from "@/lib/prisma";
import { periodKey, round2 } from "@/lib/contract-usage";
import { periodToDateRange } from "@/lib/period";
import { demandMinutesByAnalyst } from "@/services/demand-analyst-hours.service";

type Month = { year: number; month: number };

export type AnalystContractBreakdown = {
  contractId: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  hoursNormal: number;
  hoursExcess: number;
  valueNormal: number;
  valueExcess: number;
  valueTotal: number;
};

export type AnalystUsageRow = {
  analystId: string;
  analystName: string;
  analystColor: string;
  hourlyRate: number | null;
  excessHourlyRate: number | null;
  contracts: AnalystContractBreakdown[];
  totals: { hoursNormal: number; hoursExcess: number; valueNormal: number; valueExcess: number; valueTotal: number };
};

function emptyTotals() {
  return { hoursNormal: 0, hoursExcess: 0, valueNormal: 0, valueExcess: 0, valueTotal: 0 };
}

/**
 * Per analyst, per contract, monthly hours/value breakdown: each analyst's "horas normais" are
 * their own demand hours on that contract, up to the contract's monthly allowance; hours beyond the
 * allowance ("horas excedentes") are the contract's total excess, rated proportionally to each
 * analyst's share of the contract's hours that month, and priced at THAT analyst's own
 * `excessHourlyRate` (never a single contract-wide rate). Rates are always read live from the
 * analyst's current record — never snapshotted on the contract.
 *
 * Known limitation (shared with `contract-usage.service.ts`'s per-client usage): if a client has
 * two contracts in force in the same month, an "avulsa" demand (no project) of that client is
 * counted against each of them independently, since such a demand has no contract FK. Rare in
 * practice — a client normally has a single active contract at a time.
 */
async function getMonthlyAnalystUsage(organizationId: string, allowedClientIds: string[], month: Month): Promise<AnalystUsageRow[]> {
  const range = periodToDateRange(month)!;

  const contracts = await prisma.clientContract.findMany({
    where: {
      clientId: { in: allowedClientIds },
      status: { notIn: ["CANCELLED", "SUSPENDED"] },
      startDate: { lt: range.lt },
      OR: [{ endDate: null }, { endDate: { gte: range.gte } }],
      client: { organizationId, deletedAt: null },
      contractAnalysts: { some: {} },
    },
    select: {
      id: true,
      clientId: true,
      contractedHours: true,
      client: { select: { name: true, color: true } },
      extraHours: { where: { period: periodKey(month) }, select: { hours: true } },
      contractAnalysts: { select: { analystId: true } },
      projects: { select: { id: true } },
    },
  });
  if (contracts.length === 0) return [];

  const allAnalystIds = [...new Set(contracts.flatMap((c) => c.contractAnalysts.map((ca) => ca.analystId)))];
  const analysts = await prisma.analyst.findMany({
    where: { id: { in: allAnalystIds } },
    select: { id: true, name: true, color: true, hourlyRate: true, excessHourlyRate: true },
  });
  const analystById = new Map(analysts.map((a) => [a.id, a]));

  const byAnalyst = new Map<string, AnalystUsageRow>();

  for (const contract of contracts) {
    const projectIds = contract.projects.map((p) => p.id);
    const minutesPerAnalyst = await demandMinutesByAnalyst({
      deletedAt: null,
      organizationId,
      date: range,
      OR: [{ clientId: contract.clientId, projectId: null }, ...(projectIds.length ? [{ projectId: { in: projectIds } }] : [])],
    });

    const linkedIds = new Set(contract.contractAnalysts.map((ca) => ca.analystId));
    const hoursByAnalyst = new Map(
      minutesPerAnalyst.filter((m) => linkedIds.has(m.analystId)).map((m) => [m.analystId, round2(m.minutes / 60)])
    );

    const totalUsedHours = round2([...hoursByAnalyst.values()].reduce((sum, h) => sum + h, 0));
    const extraHours = round2(contract.extraHours.reduce((sum, e) => sum + e.hours, 0));
    const allowance = round2(contract.contractedHours + extraHours);
    const contractExcessHours = Math.max(0, round2(totalUsedHours - allowance));

    for (const analystId of linkedIds) {
      const analystHours = hoursByAnalyst.get(analystId) ?? 0;
      const excessHours = totalUsedHours > 0 ? round2(contractExcessHours * (analystHours / totalUsedHours)) : 0;
      const normalHours = round2(analystHours - excessHours);

      const analyst = analystById.get(analystId);
      const valueNormal = round2(normalHours * (analyst?.hourlyRate ?? 0));
      const valueExcess = round2(excessHours * (analyst?.excessHourlyRate ?? 0));

      const breakdown: AnalystContractBreakdown = {
        contractId: contract.id,
        clientId: contract.clientId,
        clientName: contract.client.name,
        clientColor: contract.client.color,
        hoursNormal: normalHours,
        hoursExcess: excessHours,
        valueNormal,
        valueExcess,
        valueTotal: round2(valueNormal + valueExcess),
      };

      const row =
        byAnalyst.get(analystId) ??
        ({
          analystId,
          analystName: analyst?.name ?? "Analista",
          analystColor: analyst?.color ?? "#6366f1",
          hourlyRate: analyst?.hourlyRate ?? null,
          excessHourlyRate: analyst?.excessHourlyRate ?? null,
          contracts: [],
          totals: emptyTotals(),
        } satisfies AnalystUsageRow);

      row.contracts.push(breakdown);
      row.totals.hoursNormal = round2(row.totals.hoursNormal + breakdown.hoursNormal);
      row.totals.hoursExcess = round2(row.totals.hoursExcess + breakdown.hoursExcess);
      row.totals.valueNormal = round2(row.totals.valueNormal + breakdown.valueNormal);
      row.totals.valueExcess = round2(row.totals.valueExcess + breakdown.valueExcess);
      row.totals.valueTotal = round2(row.totals.valueTotal + breakdown.valueTotal);
      byAnalyst.set(analystId, row);
    }
  }

  return [...byAnalyst.values()].sort((a, b) => a.analystName.localeCompare(b.analystName, "pt-BR"));
}

export const analystDashboardService = { getMonthlyAnalystUsage };
