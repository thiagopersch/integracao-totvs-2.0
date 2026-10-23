import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail, type EmailAttachment } from "@/lib/mailer";
import { toExportRow, type DemandForExport } from "@/lib/export-mappers";
import { demandsByClientXlsxBuffer, demandsXlsxBuffer, XLSX_CONTENT_TYPE } from "@/lib/demands-xlsx";
import { contractUsageXlsxBuffer } from "@/lib/contract-usage-xlsx";
import { demandMinutesByStatus, formatMonthLabel } from "@/lib/contract-usage";
import { parseTemplateAttachments, resolveAttachmentFileName } from "@/lib/message-templates/attachments";
import {
  buildAllClientsDemandReportVars,
  buildAllClientsUsageVars,
  buildDemandReportVars,
  buildGeneralVars,
  type TemplateVars,
} from "@/lib/message-templates/vars-builder";
import type { BlockTree } from "@/lib/message-templates/block-types";
import { isReportPeriodKind, resolveReportPeriod, type ResolvedReportPeriod } from "@/lib/report-period";
import { computeNextReportRunAt } from "@/lib/report-schedule";
import { messageRenderService, renderEmailFromContent } from "@/services/message-render.service";
import { messageTemplateService } from "@/services/message-template.service";
import { auditService } from "@/services/audit.service";
import { demandIncludeRelations } from "@/services/demand.service";
import { contractUsageService, type ClientMonthlyUsage } from "@/services/contract-usage.service";
import type { DemandReportScheduleInput } from "@/schemas/demand-report-schedule.schema";
import type { BackupSchedule, Client, MessageTemplate } from "@/generated/prisma/client";

const SCHEDULER_LOCK = "demand-report-scheduler";

type ScheduleRecord = NonNullable<Awaited<ReturnType<typeof prisma.demandReportSchedule.findFirst>>>;

export interface ScheduleRunResult {
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "EMPTY";
  message: string;
  sent: number;
  failed: number;
  skipped: number;
}

/** Demands of one client in the period, in the "Exportar demandas" order. */
async function getClientDemands(organizationId: string, clientId: string, period: { gte: Date; lt: Date }) {
  return prisma.demand.findMany({
    where: { organizationId, clientId, deletedAt: null, date: { gte: period.gte, lt: period.lt } },
    orderBy: { date: "asc" },
    include: demandIncludeRelations,
  });
}

/**
 * What a schedule sends, from its template: one email per client (DEMAND_REPORT, PER_CLIENT) or a
 * single email with every client — demands (DEMAND_REPORT) or hours consumption (CONTRACT_USAGE).
 */
export type ReportMode = "DEMANDS_PER_CLIENT" | "DEMANDS_ALL_CLIENTS" | "USAGE_ALL_CLIENTS";

export function reportMode(template: Pick<MessageTemplate, "event" | "scope">): ReportMode | null {
  if (template.event === "DEMAND_REPORT") return template.scope === "ALL_CLIENTS" ? "DEMANDS_ALL_CLIENTS" : "DEMANDS_PER_CLIENT";
  if (template.event === "CONTRACT_USAGE" && template.scope === "ALL_CLIENTS") return "USAGE_ALL_CLIENTS";
  return null;
}

/** Consumption is monthly: the reference month is the month the period starts in. */
const usageMonth = (period: ResolvedReportPeriod) => ({ year: period.gte.getUTCFullYear(), month: period.gte.getUTCMonth() + 1 });

/** Demands of several clients in the period, grouped by client (same order as getClientDemands). */
export async function getDemandsByClient(organizationId: string, clientIds: string[], period: { gte: Date; lt: Date }) {
  const demands = await prisma.demand.findMany({
    where: { organizationId, clientId: { in: clientIds }, deletedAt: null, date: { gte: period.gte, lt: period.lt } },
    orderBy: { date: "asc" },
    include: demandIncludeRelations,
  });
  const byClient = new Map<string, typeof demands>();
  for (const demand of demands) byClient.set(demand.clientId, [...(byClient.get(demand.clientId) ?? []), demand]);
  return byClient;
}

/** Monthly allowance (contract + extras) of each client for the report's reference month, by client id. */
export async function getUsageByClient(organizationId: string, clientIds: string[], period: ResolvedReportPeriod) {
  if (clientIds.length === 0) return new Map<string, ClientMonthlyUsage>();
  const usage = await contractUsageService.getMonthlyUsage(organizationId, usageMonth(period), clientIds);
  return new Map(usage.map((u) => [u.clientId, u]));
}

/** Subject/body/attachments of the ALL_CLIENTS demands report (a table row or container per client). */
function renderAllClientsDemandReport(
  template: MessageTemplate,
  baseVars: TemplateVars,
  period: ResolvedReportPeriod,
  groups: { client: Client; demands: DemandForExport[]; usage?: ClientMonthlyUsage | null }[]
) {
  const vars: TemplateVars = {
    ...baseVars,
    ...buildAllClientsDemandReportVars({ period, clients: groups.map((g) => g.demands), usage: groups.map((g) => g.usage) }),
  };
  const attachments: EmailAttachment[] = [];
  for (const config of parseTemplateAttachments(template.attachments)) {
    if (config.type !== "DEMANDS_XLSX") continue;
    attachments.push({
      filename: resolveAttachmentFileName(config.fileName, vars),
      content: demandsByClientXlsxBuffer(
        groups.map((g) => {
          const { executedMinutes, scheduledMinutes, totalMinutes } = demandMinutesByStatus(g.demands);
          return {
            clientName: g.client.name,
            rows: g.demands.map(toExportRow),
            minutes: totalMinutes,
            executedMinutes,
            scheduledMinutes,
            usage: g.usage,
          };
        })
      ),
      contentType: XLSX_CONTENT_TYPE,
    });
  }
  vars.attachmentNames = attachments.map((a) => a.filename).join(", ");
  const clients = groups.map((g) => ({
    ...vars,
    ...buildDemandReportVars({ client: g.client, period, demands: g.demands, usage: g.usage }),
  }));
  const rendered = renderEmailFromContent(template.subject, (template.content ?? []) as unknown as BlockTree, vars, clients, {
    emailWidth: template.emailWidth,
  });
  return { rendered, attachments };
}

/** Subject/body/attachments of the ALL_CLIENTS hours consumption email (one table per client). */
function renderAllClientsUsage(
  template: MessageTemplate,
  baseVars: TemplateVars,
  period: ResolvedReportPeriod,
  usage: ClientMonthlyUsage[],
  clientsVars: TemplateVars[]
) {
  const month = usageMonth(period);
  const monthPeriod = { label: formatMonthLabel(month), slug: `${month.year}-${String(month.month).padStart(2, "0")}` };
  const vars: TemplateVars = { ...baseVars, ...buildAllClientsUsageVars({ period: monthPeriod, usage }) };
  const attachments: EmailAttachment[] = [];
  for (const config of parseTemplateAttachments(template.attachments)) {
    if (config.type !== "CONTRACT_USAGE_XLSX") continue;
    attachments.push({
      filename: resolveAttachmentFileName(config.fileName, vars),
      content: contractUsageXlsxBuffer(usage, monthPeriod.label),
      contentType: XLSX_CONTENT_TYPE,
    });
  }
  vars.attachmentNames = attachments.map((a) => a.filename).join(", ");
  const clients = clientsVars.map((c) => ({ ...vars, ...c }));
  const rendered = renderEmailFromContent(template.subject, (template.content ?? []) as unknown as BlockTree, vars, clients, {
    emailWidth: template.emailWidth,
  });
  return { rendered, attachments };
}

/** Generates the files a template asks for (MessageTemplate.attachments) for one client. */
function buildAttachments(template: Pick<MessageTemplate, "attachments">, demands: DemandForExport[], vars: TemplateVars) {
  const attachments: EmailAttachment[] = [];
  for (const config of parseTemplateAttachments(template.attachments)) {
    if (config.type === "DEMANDS_XLSX") {
      attachments.push({
        filename: resolveAttachmentFileName(config.fileName, vars),
        content: demandsXlsxBuffer(demands.map(toExportRow)),
        contentType: XLSX_CONTENT_TYPE,
      });
    }
  }
  return attachments;
}

/** Subject/body/attachments of one client's report email. */
async function renderClientReport(
  organizationId: string,
  template: MessageTemplate,
  client: Client,
  period: ResolvedReportPeriod,
  demands: DemandForExport[],
  to: string[]
) {
  const vars: TemplateVars = {
    ...(await messageRenderService.baseVars(organizationId)),
    // Same recipient rule as the contract usage email: the client's responsible, else the client.
    ...buildGeneralVars({ recipientName: client.responsible || client.name, recipientEmail: to.join(", ") }),
    ...buildDemandReportVars({ client, period, demands, usage: (await getUsageByClient(organizationId, [client.id], period)).get(client.id) }),
  };
  const attachments = buildAttachments(template, demands, vars);
  vars.attachmentNames = attachments.map((a) => a.filename).join(", ");
  const rendered = renderEmailFromContent(template.subject, (template.content ?? []) as unknown as BlockTree, vars, undefined, {
    emailWidth: template.emailWidth,
  });
  return { rendered, attachments };
}

function toData(input: DemandReportScheduleInput) {
  return {
    name: input.name,
    templateId: input.templateId,
    period: input.period,
    clientIds: input.clientIds,
    toEmails: input.toEmails,
    ccEmails: input.ccEmails,
    sendToClientEmail: input.sendToClientEmail,
    schedule: input.schedule as BackupSchedule,
    scheduleTime: input.schedule === "NONE" ? null : input.scheduleTime,
    dayOfMonth: input.schedule === "MONTHLY" ? input.dayOfMonth : null,
    isActive: input.isActive,
    nextRunAt:
      input.isActive && input.schedule !== "NONE"
        ? computeNextReportRunAt(input.schedule as BackupSchedule, new Date(), input.scheduleTime, input.dayOfMonth)
        : null,
  };
}

async function assertTemplate(input: DemandReportScheduleInput, organizationId: string) {
  const template = await messageTemplateService.getById(input.templateId, organizationId);
  const mode = template && template.channel === "EMAIL" ? reportMode(template) : null;
  if (!mode) {
    throw new Error(
      "Selecione um template de e-mail do relatório de demandas ou de consumo de horas com escopo \"Todos os clientes\""
    );
  }
  if (mode !== "DEMANDS_PER_CLIENT" && input.toEmails.length === 0) {
    throw new Error("Informe ao menos um destinatário em \"Para\": o e-mail com todos os clientes não vai ao e-mail de cada cliente");
  }
  if (mode === "USAGE_ALL_CLIENTS" && input.period !== "currentMonth" && input.period !== "previousMonth") {
    throw new Error("O consumo de horas é mensal: escolha \"Mês atual\" ou \"Mês anterior\" como período");
  }
}

export const demandReportService = {
  async list(organizationId: string) {
    return prisma.demandReportSchedule.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { template: { select: { id: true, name: true, event: true, scope: true, isActive: true, deletedAt: true } } },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.demandReportSchedule.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  async create(input: DemandReportScheduleInput, organizationId: string) {
    await assertTemplate(input, organizationId);
    return prisma.demandReportSchedule.create({ data: { ...toData(input), organizationId } });
  },

  async update(id: string, input: DemandReportScheduleInput, organizationId: string) {
    if (!(await this.getById(id, organizationId))) throw new Error("Regra de envio não encontrada");
    await assertTemplate(input, organizationId);
    return prisma.demandReportSchedule.update({ where: { id }, data: toData(input) });
  },

  async setActive(id: string, isActive: boolean, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) throw new Error("Regra de envio não encontrada");
    const nextRunAt =
      isActive && existing.schedule !== "NONE"
        ? computeNextReportRunAt(existing.schedule, new Date(), existing.scheduleTime, existing.dayOfMonth)
        : null;
    return prisma.demandReportSchedule.update({ where: { id }, data: { isActive, nextRunAt } });
  },

  async remove(id: string, organizationId: string) {
    if (!(await this.getById(id, organizationId))) throw new Error("Regra de envio não encontrada");
    await prisma.demandReportSchedule.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, nextRunAt: null } });
  },

  /** Clients the schedule would email right now (those with demands in the period). */
  async previewClients(schedule: Pick<ScheduleRecord, "organizationId" | "clientIds" | "period">, now = new Date()) {
    const period = resolveReportPeriod(isReportPeriodKind(schedule.period) ? schedule.period : "currentMonth", now);
    const clients = await prisma.client.findMany({
      where: {
        organizationId: schedule.organizationId,
        deletedAt: null,
        ...(schedule.clientIds.length ? { id: { in: schedule.clientIds } } : {}),
        demands: { some: { deletedAt: null, date: { gte: period.gte, lt: period.lt } } },
      },
      orderBy: { name: "asc" },
    });
    return { period, clients };
  },

  /**
   * What "Enviar agora" would send: the mode and the clients it covers. In the ALL_CLIENTS modes
   * they all go in a single email; consumption covers the clients with a contract in force.
   */
  async previewRun(schedule: Pick<ScheduleRecord, "organizationId" | "clientIds" | "period" | "templateId">, now = new Date()) {
    const template = await messageTemplateService.getById(schedule.templateId, schedule.organizationId);
    const mode = template ? reportMode(template) : null;
    if (mode === "USAGE_ALL_CLIENTS") {
      const period = resolveReportPeriod(isReportPeriodKind(schedule.period) ? schedule.period : "currentMonth", now);
      const month = usageMonth(period);
      const usage = await contractUsageService.getMonthlyUsage(
        schedule.organizationId,
        month,
        schedule.clientIds.length ? schedule.clientIds : undefined
      );
      const clients = usage
        .map((u) => ({ id: u.clientId, name: u.clientName, email: u.clientEmail }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return { mode, periodLabel: formatMonthLabel(month), clients };
    }
    const { period, clients } = await this.previewClients(schedule, now);
    return { mode: mode ?? ("DEMANDS_PER_CLIENT" as const), periodLabel: period.label, clients };
  },

  /**
   * Sends the report: one email per client with demands in the period, to `toEmails` (+ the client's
   * own e-mail when enabled) with `ccEmails` in copy. Records the outcome on the schedule; scheduled
   * runs (not manual ones) also re-anchor `nextRunAt` — even on failure, so a broken schedule never
   * fires in a tight loop.
   */
  async run(id: string, organizationId: string, options: { manual: boolean; userId?: string; now?: Date }): Promise<ScheduleRunResult> {
    const schedule = await this.getById(id, organizationId);
    if (!schedule) throw new Error("Regra de envio não encontrada");
    const now = options.now ?? new Date();

    let result: ScheduleRunResult;
    try {
      result = await this.send(schedule, now, options.userId);
    } catch (error) {
      result = { status: "FAILED", message: (error as Error).message, sent: 0, failed: 0, skipped: 0 };
    }

    await prisma.demandReportSchedule.update({
      where: { id },
      data: {
        lastRunAt: now,
        lastRunStatus: result.status,
        lastRunMessage: result.message,
        ...(!options.manual
          ? {
              nextRunAt:
                schedule.isActive && schedule.schedule !== "NONE"
                  ? computeNextReportRunAt(schedule.schedule, now, schedule.scheduleTime, schedule.dayOfMonth)
                  : null,
            }
          : {}),
      },
    });
    await auditService.log({
      action: "SEND_REPORT",
      entity: "DemandReportSchedule",
      entityId: id,
      organizationId,
      userId: options.userId,
      newData: { name: schedule.name, manual: options.manual, ...result },
    });
    return result;
  },

  async send(schedule: ScheduleRecord, now: Date, userId?: string): Promise<ScheduleRunResult> {
    const template = await messageTemplateService.getById(schedule.templateId, schedule.organizationId);
    if (!template || template.channel !== "EMAIL") throw new Error("O template de e-mail da regra não existe mais");
    if (!template.isActive) throw new Error(`O template "${template.name}" está inativo`);
    const mode = reportMode(template);
    if (!mode) throw new Error(`O template "${template.name}" não pode ser usado em regras de envio`);
    if (mode !== "DEMANDS_PER_CLIENT") return this.sendAllClients(schedule, template, mode, now, userId);

    const { period, clients } = await this.previewClients(schedule, now);
    if (clients.length === 0) {
      return { status: "EMPTY", message: `Nenhum cliente com demandas em ${period.label}`, sent: 0, failed: 0, skipped: 0 };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const problems: string[] = [];
    for (const client of clients) {
      const to = [...schedule.toEmails, ...(schedule.sendToClientEmail && client.email ? [client.email.trim()] : [])];
      if (to.length === 0) {
        skipped++;
        problems.push(`${client.name}: sem destinatário (cliente sem e-mail cadastrado)`);
        continue;
      }
      const demands = await getClientDemands(schedule.organizationId, client.id, period);
      const recipients = [...new Set(to)];
      const { rendered, attachments } = await renderClientReport(schedule.organizationId, template, client, period, demands, recipients);
      const status = await sendEmail(schedule.organizationId, recipients, rendered.subject, rendered.text, userId, {
        html: rendered.html,
        cc: schedule.ccEmails,
        attachments,
      });
      if (status === "SENT") sent++;
      else if (status === "SKIPPED") {
        // SMTP disabled/not configured: every other client would be skipped the same way.
        throw new Error("Envio de e-mail desativado — configure o SMTP em Integrações > E-mail (SMTP)");
      } else {
        failed++;
        problems.push(`${client.name}: falha no envio (veja Rastreamento de Atividades)`);
      }
    }

    const summary = `${sent} e-mail(s) enviado(s) — ${period.label}`;
    const message = problems.length ? `${summary}. ${problems.join("; ")}` : summary;
    const status = sent === 0 ? "FAILED" : failed || skipped ? "PARTIAL" : "SUCCESS";
    return { status, message, sent, failed, skipped };
  },

  /** ALL_CLIENTS modes: a single email to `toEmails` (+ `ccEmails`) with one table per client. */
  async sendAllClients(
    schedule: ScheduleRecord,
    template: MessageTemplate,
    mode: Exclude<ReportMode, "DEMANDS_PER_CLIENT">,
    now: Date,
    userId?: string
  ): Promise<ScheduleRunResult> {
    const period = resolveReportPeriod(isReportPeriodKind(schedule.period) ? schedule.period : "currentMonth", now);
    const recipients = [...new Set(schedule.toEmails.map((e) => e.trim()).filter(Boolean))];
    if (recipients.length === 0) throw new Error("A regra não tem destinatários em \"Para\"");
    const baseVars: TemplateVars = {
      ...(await messageRenderService.baseVars(schedule.organizationId)),
      ...buildGeneralVars({ recipientEmail: recipients.join(", ") }),
    };

    let rendered: ReturnType<typeof renderEmailFromContent>;
    let attachments: EmailAttachment[];
    let clientsCount: number;
    let label: string;
    if (mode === "DEMANDS_ALL_CLIENTS") {
      const { clients } = await this.previewClients(schedule, now);
      if (clients.length === 0) {
        return { status: "EMPTY", message: `Nenhum cliente com demandas em ${period.label}`, sent: 0, failed: 0, skipped: 0 };
      }
      const clientIds = clients.map((c) => c.id);
      const [byClient, usageByClient] = await Promise.all([
        getDemandsByClient(schedule.organizationId, clientIds, period),
        getUsageByClient(schedule.organizationId, clientIds, period),
      ]);
      const groups = clients.map((client) => ({ client, demands: byClient.get(client.id) ?? [], usage: usageByClient.get(client.id) }));
      ({ rendered, attachments } = renderAllClientsDemandReport(template, baseVars, period, groups));
      clientsCount = clients.length;
      label = period.label;
    } else {
      const month = usageMonth(period);
      const { usage, clients } = await contractUsageService.getAllClientsUsageVars(
        schedule.organizationId,
        month,
        schedule.clientIds.length ? schedule.clientIds : undefined
      );
      label = formatMonthLabel(month);
      if (usage.length === 0) {
        return { status: "EMPTY", message: `Nenhum cliente com contrato vigente em ${label}`, sent: 0, failed: 0, skipped: 0 };
      }
      ({ rendered, attachments } = renderAllClientsUsage(template, baseVars, period, usage, clients));
      clientsCount = usage.length;
    }

    const status = await sendEmail(schedule.organizationId, recipients, rendered.subject, rendered.text, userId, {
      html: rendered.html,
      cc: schedule.ccEmails,
      attachments,
    });
    if (status === "SKIPPED") throw new Error("Envio de e-mail desativado — configure o SMTP em Integrações > E-mail (SMTP)");
    if (status !== "SENT") {
      return { status: "FAILED", message: "Falha no envio (veja Rastreamento de Atividades)", sent: 0, failed: 1, skipped: 0 };
    }
    return { status: "SUCCESS", message: `1 e-mail enviado com ${clientsCount} cliente(s) — ${label}`, sent: 1, failed: 0, skipped: 0 };
  },

  /** Sample attachments for "Enviar teste": the client with the most recent demand in the current month. */
  async buildTestAttachments(organizationId: string, allowedClientIds: string[], template: MessageTemplate, vars: TemplateVars) {
    const configs = parseTemplateAttachments(template.attachments);
    if (configs.length === 0) return { attachments: [] as EmailAttachment[], vars };
    const period = resolveReportPeriod("currentMonth");
    const mode = reportMode(template);
    if (mode === "USAGE_ALL_CLIENTS") {
      const { usage, clients } = await contractUsageService.getAllClientsUsageVars(organizationId, usageMonth(period), allowedClientIds);
      const { attachments } = renderAllClientsUsage(template, vars, period, usage, clients);
      return { attachments, vars: { ...vars, attachmentNames: attachments.map((a) => a.filename).join(", ") } };
    }
    if (mode === "DEMANDS_ALL_CLIENTS") {
      const { clients } = await this.previewClients({ organizationId, clientIds: allowedClientIds, period: "currentMonth" });
      const clientIds = clients.map((c) => c.id);
      const [byClient, usageByClient] = await Promise.all([
        getDemandsByClient(organizationId, clientIds, period),
        getUsageByClient(organizationId, clientIds, period),
      ]);
      const groups = clients.map((client) => ({ client, demands: byClient.get(client.id) ?? [], usage: usageByClient.get(client.id) }));
      const { attachments } = renderAllClientsDemandReport(template, vars, period, groups);
      return { attachments, vars: { ...vars, attachmentNames: attachments.map((a) => a.filename).join(", ") } };
    }
    const latest = await prisma.demand.findFirst({
      where: { organizationId, deletedAt: null, clientId: { in: allowedClientIds }, date: { gte: period.gte, lt: period.lt } },
      orderBy: { date: "desc" },
      select: { client: true },
    });
    if (!latest) {
      const attachments = buildAttachments(template, [], vars);
      return { attachments, vars: { ...vars, attachmentNames: attachments.map((a) => a.filename).join(", ") } };
    }
    const demands = await getClientDemands(organizationId, latest.client.id, period);
    const usage = (await getUsageByClient(organizationId, [latest.client.id], period)).get(latest.client.id);
    const realVars = { ...vars, ...buildDemandReportVars({ client: latest.client, period, demands, usage }) };
    const attachments = buildAttachments(template, demands, realVars);
    return { attachments, vars: { ...realVars, attachmentNames: attachments.map((a) => a.filename).join(", ") } };
  },

  /** Scheduler tick (lib/demand-report-scheduler.ts) — guarded by an advisory lock like the backups. */
  async runDueSchedules() {
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${SCHEDULER_LOCK})::bigint) AS locked
    `;
    if (!locked) return { processed: 0 };
    try {
      const due = await prisma.demandReportSchedule.findMany({
        where: { deletedAt: null, isActive: true, schedule: { not: "NONE" }, nextRunAt: { lte: new Date() } },
        select: { id: true, organizationId: true, name: true },
      });
      for (const schedule of due) {
        try {
          await this.run(schedule.id, schedule.organizationId, { manual: false });
        } catch (error) {
          logger.error("Falha na regra de envio de relatório", { scheduleId: schedule.id, error: (error as Error).message });
        }
      }
      return { processed: due.length };
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${SCHEDULER_LOCK})::bigint)`;
    }
  },
};
