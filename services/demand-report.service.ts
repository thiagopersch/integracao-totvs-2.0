import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendEmail, type EmailAttachment } from "@/lib/mailer";
import { toExportRow, type DemandForExport } from "@/lib/export-mappers";
import { demandsXlsxBuffer, XLSX_CONTENT_TYPE } from "@/lib/demands-xlsx";
import { parseTemplateAttachments, resolveAttachmentFileName } from "@/lib/message-templates/attachments";
import { buildDemandReportVars, type TemplateVars } from "@/lib/message-templates/vars-builder";
import type { BlockTree } from "@/lib/message-templates/block-types";
import { isReportPeriodKind, resolveReportPeriod, type ResolvedReportPeriod } from "@/lib/report-period";
import { computeNextReportRunAt } from "@/lib/report-schedule";
import { messageRenderService, renderEmailFromContent } from "@/services/message-render.service";
import { messageTemplateService } from "@/services/message-template.service";
import { auditService } from "@/services/audit.service";
import { demandIncludeRelations } from "@/services/demand.service";
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
  demands: DemandForExport[]
) {
  const vars: TemplateVars = {
    ...(await messageRenderService.baseVars(organizationId)),
    ...buildDemandReportVars({ client, period, demands }),
  };
  const attachments = buildAttachments(template, demands, vars);
  vars.attachmentNames = attachments.map((a) => a.filename).join(", ");
  const rendered = renderEmailFromContent(template.subject, (template.content ?? []) as unknown as BlockTree, vars);
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

async function assertTemplate(templateId: string, organizationId: string) {
  const template = await messageTemplateService.getById(templateId, organizationId);
  if (!template || template.channel !== "EMAIL" || template.event !== "DEMAND_REPORT") {
    throw new Error("Selecione um template de e-mail do evento \"Relatório de demandas do período\"");
  }
}

export const demandReportService = {
  async list(organizationId: string) {
    return prisma.demandReportSchedule.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { template: { select: { id: true, name: true, isActive: true, deletedAt: true } } },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.demandReportSchedule.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  async create(input: DemandReportScheduleInput, organizationId: string) {
    await assertTemplate(input.templateId, organizationId);
    return prisma.demandReportSchedule.create({ data: { ...toData(input), organizationId } });
  },

  async update(id: string, input: DemandReportScheduleInput, organizationId: string) {
    if (!(await this.getById(id, organizationId))) throw new Error("Regra de envio não encontrada");
    await assertTemplate(input.templateId, organizationId);
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
      const { rendered, attachments } = await renderClientReport(schedule.organizationId, template, client, period, demands);
      const status = await sendEmail(schedule.organizationId, [...new Set(to)], rendered.subject, rendered.text, userId, {
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

  /** Sample attachments for "Enviar teste": the client with the most recent demand in the current month. */
  async buildTestAttachments(organizationId: string, allowedClientIds: string[], template: MessageTemplate, vars: TemplateVars) {
    const configs = parseTemplateAttachments(template.attachments);
    if (configs.length === 0) return { attachments: [] as EmailAttachment[], vars };
    const period = resolveReportPeriod("currentMonth");
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
    const realVars = { ...vars, ...buildDemandReportVars({ client: latest.client, period, demands }) };
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
