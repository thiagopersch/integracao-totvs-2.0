import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail, type EmailSendStatus } from "@/lib/mailer";
import { periodToDateRange } from "@/lib/period";
import {
  CONTRACT_ATTENTION_PERCENT,
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
import { messageRenderService } from "@/services/message-render.service";
import { buildContractUsageVars, buildDemandVars, buildGeneralVars } from "@/lib/message-templates/vars-builder";

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
  /** Demands launched for the client in the month. */
  demandsCount: number;
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
    _count: { _all: true },
  });
  const usedMinutesByClientId = new Map(minutesByClient.map((d) => [d.clientId, d._sum.durationMinutes || 0]));
  const demandsCountByClientId = new Map(minutesByClient.map((d) => [d.clientId, d._count._all]));

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
      demandsCount: demandsCountByClientId.get(contract.clientId) ?? 0,
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

export type UsageCheckTrigger = "demand" | "contract" | "manual";

export type UsageNotifyResult = {
  /** NO_CONTRACT: no contract in force this month; NO_RECIPIENT: no client/alert email configured;
   *  NOT_DUE: nothing to send for this trigger (below 80% / no new threshold). */
  status: EmailSendStatus | "NO_CONTRACT" | "NO_RECIPIENT" | "NOT_DUE";
  to?: string;
  cc?: string[];
  percent?: number;
};

/** Email recipients: the client (when the contract opts in and it has an email) with the
 *  contract-alert address in CC — otherwise just the contract-alert address. */
async function resolveRecipients(organizationId: string, usage: ClientMonthlyUsage) {
  const settings = await prisma.emailSettings.findUnique({ where: { organizationId }, select: { contractAlertEmail: true } });
  const alertEmail = settings?.contractAlertEmail?.trim() || null;
  const clientEmail = usage.notifyClient ? usage.clientEmail : null;
  const to = clientEmail ?? alertEmail;
  const cc =
    clientEmail && alertEmail && alertEmail.toLowerCase() !== clientEmail.toLowerCase() ? [alertEmail] : undefined;
  return { to, cc, sentToClient: !!clientEmail };
}

async function sendUsageEmail(
  organizationId: string,
  usage: ClientMonthlyUsage,
  month: Month,
  demandId?: string
): Promise<UsageNotifyResult> {
  const { to, cc, sentToClient } = await resolveRecipients(organizationId, usage);
  if (!to) return { status: "NO_RECIPIENT", percent: usage.percent };

  const [client, contracts, demand] = await Promise.all([
    prisma.client.findUniqueOrThrow({
      where: { id: usage.clientId },
      select: { name: true, legalName: true, document: true, email: true, phone: true, responsible: true, site: true, linkCrm: true },
    }),
    prisma.clientContract.findMany({
      where: { id: { in: usage.contractIds } },
      select: { startDate: true, endDate: true, status: true, contractedHours: true, hourlyRate: true, notes: true },
    }),
    demandId
      ? prisma.demand.findFirst({
          where: { id: demandId, organizationId, clientId: usage.clientId, deletedAt: null },
          select: {
            name: true,
            description: true,
            date: true,
            startTime: true,
            endTime: true,
            durationMinutes: true,
            status: true,
            priority: true,
            demandType: { select: { name: true } },
            department: { select: { name: true } },
            analyst: { select: { name: true, email: true } },
            requester: { select: { name: true, email: true } },
          },
        })
      : null,
  ]);
  const vars = {
    ...buildGeneralVars({ recipientName: sentToClient ? client.responsible || client.name : client.name, recipientEmail: to }),
    ...buildContractUsageVars({
      client,
      usedHours: usage.usedHours,
      contractedHours: usage.contractedHours,
      percent: usage.percent,
      level: usage.level,
      periodLabel: formatMonthLabel(month),
      demandsCount: usage.demandsCount,
      contracts,
    }),
    ...buildDemandVars(demand),
  };
  const email = await messageRenderService.renderEmail(organizationId, "CONTRACT_USAGE", vars);
  const status = await sendEmail(organizationId, to, email.subject, email.text, undefined, { cc, html: email.html });
  return { status, to, cc, percent: usage.percent };
}

/**
 * Evaluates a client's consumption for one month and notifies:
 * - Bell (in-app, users linked to the client): only when a NEW threshold (80/85/90/95/100%) is
 *   reached in the month — recorded in `contract_usage_alerts`, one alert for the highest of them.
 * - Email (template CONTRACT_USAGE): `demand` → every time the month is at 80%+ (each new demand
 *   re-sends the current "X% de 100%"); `contract` → only with a new threshold; `manual` → always,
 *   whatever the percentage.
 */
async function checkAndNotify(
  organizationId: string,
  clientId: string,
  month: Month,
  trigger: UsageCheckTrigger,
  /** The demand that triggered the check — fills the "Demanda lançada" variables. */
  demandId?: string
): Promise<UsageNotifyResult> {
  const [usage] = await getMonthlyUsage(organizationId, month, [clientId]);
  if (!usage || usage.contractedHours <= 0) return { status: "NO_CONTRACT" };

  const period = periodKey(month);
  let newThreshold: number | null = null;
  const existing = await prisma.contractUsageAlert.findMany({ where: { clientId, period }, select: { threshold: true } });
  const pending = pendingThresholds(usage.percent, existing.map((e) => e.threshold));
  if (pending.length > 0) {
    // skipDuplicates + only the rows actually inserted: a concurrent check of the same client/month
    // can't notify the same threshold twice.
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
    if (inserted.length > 0) newThreshold = Math.max(...inserted.map((r) => r.threshold));
  }

  if (newThreshold !== null) {
    await notificationService.broadcastToClientUsers(
      organizationId,
      clientId,
      buildContractUsageThresholdNotification({
        clientId,
        clientName: usage.clientName,
        threshold: newThreshold,
        percent: usage.percent,
        usedHours: usage.usedHours,
        contractedHours: usage.contractedHours,
        period,
        periodLabel: formatMonthLabel(month),
      })
    );
  }

  const shouldEmail =
    trigger === "manual" ||
    (trigger === "demand" && usage.percent >= CONTRACT_ATTENTION_PERCENT) ||
    newThreshold !== null;
  if (!shouldEmail) return { status: "NOT_DUE", percent: usage.percent };

  return sendUsageEmail(organizationId, usage, month, demandId);
}

export type UsageCheckItem = { clientId: string; date: Date; trigger: UsageCheckTrigger; demandId?: string };

/** Runs `checkAndNotify` once per distinct (client, month) — so an import sends one email per
 *  client/month, not one per row. Errors are logged, never thrown, so a mail/notification failure
 *  can't break the mutation that triggered the check. */
async function checkMany(organizationId: string, items: UsageCheckItem[]): Promise<void> {
  const seen = new Set<string>();
  for (const { clientId, date, trigger, demandId } of items) {
    const month = monthOf(date);
    const key = `${clientId}:${periodKey(month)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await checkAndNotify(organizationId, clientId, month, trigger, demandId);
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
  scheduleCheck(organizationId: string, items: UsageCheckItem[]) {
    if (items.length === 0) return;
    after(() => checkMany(organizationId, items));
  },
};
