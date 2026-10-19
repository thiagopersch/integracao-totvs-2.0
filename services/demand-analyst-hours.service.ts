import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type AnalystClientMinutes = { analystId: string; clientId: string; minutes: number };

/**
 * Minutes per (analyst, client) of the demands matching `where`. A demand with several analysts
 * credits its full duration to each of them (so the sum across analysts can exceed the demand
 * hours); client/contract hours must keep summing `Demand.durationMinutes` directly.
 */
export async function demandMinutesByAnalyst(where: Prisma.DemandWhereInput): Promise<AnalystClientMinutes[]> {
  const links = await prisma.demandAnalyst.findMany({
    where: { demand: where },
    select: { analystId: true, demand: { select: { clientId: true, durationMinutes: true } } },
  });
  const byKey = new Map<string, AnalystClientMinutes>();
  for (const { analystId, demand } of links) {
    const key = `${analystId}:${demand.clientId}`;
    const row = byKey.get(key) ?? { analystId, clientId: demand.clientId, minutes: 0 };
    row.minutes += demand.durationMinutes;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

/** Same as `demandMinutesByAnalyst` but summed across clients. */
export async function demandMinutesByAnalystTotal(where: Prisma.DemandWhereInput): Promise<{ analystId: string; minutes: number }[]> {
  const totals = new Map<string, number>();
  for (const row of await demandMinutesByAnalyst(where)) totals.set(row.analystId, (totals.get(row.analystId) ?? 0) + row.minutes);
  return [...totals].map(([analystId, minutes]) => ({ analystId, minutes }));
}
