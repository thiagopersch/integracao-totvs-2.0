import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail, type EmailSendStatus } from "@/lib/mailer";
import { periodToDateRange } from "@/lib/period";
import {
  CONTRACT_ATTENTION_PERCENT,
  formatMonthLabel,
  sumMinutesByClient,
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
  /** demandHours + projectHours */
  usedHours: number;
  demandHours: number;
  /** Hours logged on tasks of projects linked to one of the client's contracts. */
  projectHours: number;
  percent: number;
  level: UsageLevel;
  notifyClient: boolean;
  contractIds: string[];
  /** Demands launched for the client in the month. */
  demandsCount: number;
  /** Project time entries logged for the client in the month. */
  timeEntriesCount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Monthly consumption per client: `contractedHours` is a monthly allowance, summed across every
 * contract in force during the month (not CANCELLED/SUSPENDED, validity overlapping the month — so
 * retroactive demands of a since-EXPIRED contract still count). Demands have no contract FK, so
 * usage is the client's demand time inside the month, same scoping the dashboard ranking uses —
 * plus hours logged on tasks of the client's projects that are linked to a contract (Gestão de
 * Projetos). Both are summed per client (lib/contract-usage.ts sumMinutesByClient).
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
  const projectMinutes = await prisma.projectTimeEntry.groupBy({
    by: ["projectId"],
    where: {
      deletedAt: null,
      organizationId,
      date: range,
      task: { deletedAt: null },
      project: { deletedAt: null, contractId: { not: null }, clientId: { in: contractClientIds } },
    },
    _sum: { minutes: true },
    _count: { _all: true },
  });
  const projects = projectMinutes.length
    ? await prisma.project.findMany({ where: { id: { in: projectMinutes.map((p) => p.projectId) } }, select: { id: true, clientId: true } })
    : [];
  const clientIdByProjectId = new Map(projects.filter((p) => p.clientId).map((p) => [p.id, p.clientId!]));
  const minutesByClientId = sumMinutesByClient(
    minutesByClient.map((d) => ({ clientId: d.clientId, minutes: d._sum.durationMinutes || 0 })),
    projectMinutes.map((p) => ({ projectId: p.projectId, minutes: p._sum.minutes || 0 })),
    clientIdByProjectId
  );
  const demandsCountByClientId = new Map(minutesByClient.map((d) => [d.clientId, d._count._all]));
  const timeEntriesCountByClientId = new Map<string, number>();
  for (const p of projectMinutes) {
    const clientId = clientIdByProjectId.get(p.projectId);
    if (clientId) timeEntriesCountByClientId.set(clientId, (timeEntriesCountByClientId.get(clientId) ?? 0) + p._count._all);
  }

  const byClient = new Map<string, ClientMonthlyUsage>();
  for (const contract of contracts) {
    const minutes = minutesByClientId.get(contract.clientId);
    const entry = byClient.get(contract.clientId) ?? {
      clientId: contract.clientId,
      clientName: contract.client.name,
      clientColor: contract.client.color,
      clientEmail: contract.client.email?.trim() || null,
      contractedHours: 0,
      usedHours: round2(((minutes?.demandMinutes ?? 0) + (minutes?.projectMinutes ?? 0)) / 60),
      demandHours: round2((minutes?.demandMinutes ?? 0) / 60),
      projectHours: round2((minutes?.projectMinutes ?? 0) / 60),
      percent: 0,
      level: "ok" as UsageLevel,
      notifyClient: false,
      contractIds: [],
      demandsCount: demandsCountByClientId.get(contract.clientId) ?? 0,
      timeEntriesCount: timeEntriesCountByClientId.get(contract.clientId) ?? 0,
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

/** `time_entry`: hours logged on a contract-linked project task — emails only on a NEW threshold
 *  (time entries are frequent; re-sending the "X% de 100%" email on each one would spam). */
export type UsageCheckTrigger = "demand" | "contract" | "manual" | "time_entry";

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

  const [client, contracts, demand, minutesByAnalyst] = await Promise.all([
    prisma.client.findUniqueOrThrow({
      where: { id: usage.clientId },
      select: { name: true, legalName: true, document: true, email: true, phone: true, responsible: true, site: true, linkCrm: true },
    }),
    prisma.clientContract.findMany({
      where: { id: { in: usage.contractIds } },
      select: { startDate: true, endDate: true, status: true, notes: true },
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
    prisma.demand.groupBy({
      by: ["analystId"],
      where: { deletedAt: null, organizationId, clientId: usage.clientId, date: periodToDateRange(month)! },
      _sum: { durationMinutes: true },
    }),
  ]);
  const analysts = await prisma.analyst.findMany({
    where: { id: { in: minutesByAnalyst.map((m) => m.analystId) } },
    select: { id: true, hourlyRate: true },
  });
  const rateByAnalystId = new Map(analysts.map((a) => [a.id, a.hourlyRate]));
  const analystUsage = minutesByAnalyst.map((m) => ({
    hours: (m._sum.durationMinutes || 0) / 60,
    hourlyRate: rateByAnalystId.get(m.analystId) ?? null,
  }));

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
      analystUsage,
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
 *   re-sends the current "X% de 100%"); `contract`/`time_entry` → only with a new threshold; `manual` → always,
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
