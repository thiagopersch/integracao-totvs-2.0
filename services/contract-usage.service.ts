import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mailer";
import { periodToDateRange } from "@/lib/period";
import {
  formatHours,
  formatMonthLabel,
  monthOf,
  pendingThresholds,
  periodKey,
  usageLevel,
  usagePercent,
  type UsageLevel,
} from "@/lib/contract-usage";
import { buildContractUsageThresholdNotification } from "@/lib/notification-types";
import { notificationService } from "@/services/notification.service";

type Month = { year: number; month: number };

export type ClientMonthlyUsage = {
  clientId: string;
  clientName: string;
  clientColor: string;
  clientEmail: string | null;
  contractedHours: number;
  usedHours: number;
  percent: number;
  level: UsageLevel;
  notifyClient: boolean;
  contractIds: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Monthly consumption per client: `contractedHours` is a monthly allowance, summed across every
 * contract in force during the month (not CANCELLED/SUSPENDED, validity overlapping the month — so
 * retroactive demands of a since-EXPIRED contract still count). Demands have no contract FK, so
 * usage is the client's demand time inside the month, same scoping the dashboard ranking uses.
 */
async function getMonthlyUsage(organizationId: string, month: Month, clientIds?: string[]): Promise<ClientMonthlyUsage[]> {
  const range = periodToDateRange(month)!;
  const contracts = await prisma.clientContract.findMany({
    where: {
      status: { notIn: ["CANCELLED", "SUSPENDED"] },
      startDate: { lt: range.lt },
      OR: [{ endDate: null }, { endDate: { gte: range.gte } }],
      client: { organizationId, deletedAt: null },
      ...(clientIds ? { clientId: { in: clientIds } } : {}),
    },
    select: {
      id: true,
      clientId: true,
      contractedHours: true,
      notifyClient: true,
      client: { select: { name: true, color: true, email: true } },
    },
  });
  if (contracts.length === 0) return [];

  const contractClientIds = [...new Set(contracts.map((c) => c.clientId))];
  const minutesByClient = await prisma.demand.groupBy({
    by: ["clientId"],
    where: { deletedAt: null, organizationId, clientId: { in: contractClientIds }, date: range },
    _sum: { durationMinutes: true },
  });
  const usedMinutesByClientId = new Map(minutesByClient.map((d) => [d.clientId, d._sum.durationMinutes || 0]));

  const byClient = new Map<string, ClientMonthlyUsage>();
  for (const contract of contracts) {
    const entry = byClient.get(contract.clientId) ?? {
      clientId: contract.clientId,
      clientName: contract.client.name,
      clientColor: contract.client.color,
      clientEmail: contract.client.email?.trim() || null,
      contractedHours: 0,
      usedHours: round2((usedMinutesByClientId.get(contract.clientId) || 0) / 60),
      percent: 0,
      level: "ok" as UsageLevel,
      notifyClient: false,
      contractIds: [],
    };
    entry.contractedHours = round2(entry.contractedHours + contract.contractedHours);
    entry.notifyClient ||= contract.notifyClient;
    entry.contractIds.push(contract.id);
    byClient.set(contract.clientId, entry);
  }

  return [...byClient.values()].map((u) => {
    const percent = usagePercent(u.usedHours, u.contractedHours);
    return { ...u, percent, level: usageLevel(percent) };
  });
}

function buildEmailText(usage: ClientMonthlyUsage, threshold: number, periodLabel: string): string {
  const exceeded = threshold >= 100;
  const percentLabel = `${usage.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const balance = round2(usage.contractedHours - usage.usedHours);
  return [
    "Olá,",
    "",
    `Informamos que o consumo de horas do contrato de ${usage.clientName} referente a ${periodLabel} ${
      exceeded ? "excedeu o total contratado" : `atingiu ${percentLabel} do total contratado`
    }.`,
    "",
    `Horas contratadas no mês: ${formatHours(usage.contractedHours)}`,
    `Horas utilizadas: ${formatHours(usage.usedHours)} (${percentLabel})`,
    balance >= 0 ? `Saldo restante: ${formatHours(balance)}` : `Horas excedentes: ${formatHours(-balance)}`,
    "",
    "Este é um aviso automático.",
  ].join("\n");
}

function buildEmailSubject(usage: ClientMonthlyUsage, threshold: number, periodLabel: string): string {
  return threshold >= 100
    ? `[Atenção] Contrato ${usage.clientName} excedeu as horas de ${periodLabel}`
    : `[Atenção] Contrato ${usage.clientName} atingiu ${threshold}% das horas de ${periodLabel}`;
}

/**
 * Evaluates a client's consumption for one month and, for every alert threshold newly reached,
 * records it (dedup row) and sends ONE alert for the highest of them — a jump from 70% to 92%
 * sends the 90% alert and marks 80/85 as done. Recipients: users linked to the client (in-app,
 * plus their own opt-in email), and by email the configured contract-alert address — or, when the
 * contract has `notifyClient` and the client has an email, the client with that address in CC.
 */
async function checkAndNotify(organizationId: string, clientId: string, month: Month): Promise<void> {
  const [usage] = await getMonthlyUsage(organizationId, month, [clientId]);
  if (!usage || usage.contractedHours <= 0) return;

  const period = periodKey(month);
  const existing = await prisma.contractUsageAlert.findMany({ where: { clientId, period }, select: { threshold: true } });
  const pending = pendingThresholds(usage.percent, existing.map((e) => e.threshold));
  if (pending.length === 0) return;

  // skipDuplicates + only the rows actually inserted: a concurrent check of the same client/month
  // can't send the same threshold twice.
  const inserted = await prisma.contractUsageAlert.createManyAndReturn({
    data: pending.map((threshold) => ({
      organizationId,
      clientId,
      period,
      threshold,
      usedHours: usage.usedHours,
      contractedHours: usage.contractedHours,
    })),
    skipDuplicates: true,
    select: { threshold: true },
  });
  if (inserted.length === 0) return;

  const threshold = Math.max(...inserted.map((r) => r.threshold));
  const periodLabel = formatMonthLabel(month);

  await notificationService.broadcastToClientUsers(
    organizationId,
    clientId,
    buildContractUsageThresholdNotification({
      clientId,
      clientName: usage.clientName,
      threshold,
      percent: usage.percent,
      usedHours: usage.usedHours,
      contractedHours: usage.contractedHours,
      period,
      periodLabel,
    })
  );

  const settings = await prisma.emailSettings.findUnique({
    where: { organizationId },
    select: { contractAlertEmail: true },
  });
  const alertEmail = settings?.contractAlertEmail?.trim() || null;
  const clientEmail = usage.notifyClient ? usage.clientEmail : null;
  const to = clientEmail ?? alertEmail;
  if (!to) return;
  const cc = clientEmail && alertEmail && alertEmail.toLowerCase() !== clientEmail.toLowerCase() ? [alertEmail] : undefined;

  await sendEmail(
    organizationId,
    to,
    buildEmailSubject(usage, threshold, periodLabel),
    buildEmailText(usage, threshold, periodLabel),
    undefined,
    { cc }
  );
}

/** Runs `checkAndNotify` once per distinct (client, month) — errors are logged, never thrown, so a
 *  mail/notification failure can't break the mutation that triggered the check. */
async function checkMany(organizationId: string, items: { clientId: string; date: Date }[]): Promise<void> {
  const seen = new Set<string>();
  for (const { clientId, date } of items) {
    const month = monthOf(date);
    const key = `${clientId}:${periodKey(month)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await checkAndNotify(organizationId, clientId, month);
    } catch (error) {
      logger.error("Falha ao verificar consumo de horas do contrato", {
        organizationId,
        clientId,
        period: periodKey(month),
        error: (error as Error).message,
      });
    }
  }
}

export const contractUsageService = {
  getMonthlyUsage,
  checkAndNotify,
  checkMany,

  /** Schedules the check to run after the response is sent (next/server `after`), so server
   *  actions don't wait on SMTP. */
  scheduleCheck(organizationId: string, items: { clientId: string; date: Date }[]) {
    if (items.length === 0) return;
    after(() => checkMany(organizationId, items));
  },
};
