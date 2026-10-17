"use server"

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { assertClientAllowed } from "@/lib/client-access";
import type { RequestContext } from "@/lib/tenant";
import { auditService } from "@/services/audit.service";
import { demandReportService } from "@/services/demand-report.service";
import { messageTemplateService } from "@/services/message-template.service";
import { demandReportScheduleSchema, type DemandReportScheduleInput } from "@/schemas/demand-report-schedule.schema";

/** The schedule sends with no user in context, so its clients must fit the creator's scope: "every
 *  client" (empty list) is only allowed to users who can see every client of the organization. */
async function assertClientScope(input: DemandReportScheduleInput, ctx: RequestContext) {
  if (input.clientIds.length) {
    input.clientIds.forEach((id) => assertClientAllowed(id, ctx.allowedClientIds));
    return;
  }
  const total = await prisma.client.count({ where: { organizationId: ctx.organizationId, deletedAt: null } });
  const visible = await prisma.client.count({
    where: { organizationId: ctx.organizationId, deletedAt: null, id: { in: ctx.allowedClientIds } },
  });
  if (visible < total) throw new Error("Selecione os clientes do relatório (você não tem acesso a todos os clientes)");
}

function parse(input: unknown) {
  const parsed = demandReportScheduleSchema.safeParse(input);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
}

export async function getReportSchedulesPageData() {
  const ctx = await requirePermission("report_schedules", "read");
  const [schedules, templates, clients] = await Promise.all([
    demandReportService.list(ctx.organizationId),
    messageTemplateService.listActiveEmail(ctx.organizationId, "DEMAND_REPORT"),
    prisma.client.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null, id: { in: ctx.allowedClientIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return { schedules, templates, clients };
}

export async function createReportSchedule(input: unknown) {
  const ctx = await requirePermission("report_schedules", "create");
  const { data, error } = parse(input);
  if (!data) return { success: false, error };
  try {
    await assertClientScope(data, ctx);
    const entity = await demandReportService.create(data, ctx.organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "DemandReportSchedule",
      entityId: entity.id,
      newData: { name: entity.name, toEmails: entity.toEmails, ccEmails: entity.ccEmails, schedule: entity.schedule },
    });
    return { success: true, id: entity.id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updateReportSchedule(id: string, input: unknown) {
  const ctx = await requirePermission("report_schedules", "update");
  const { data, error } = parse(input);
  if (!data) return { success: false, error };
  try {
    await assertClientScope(data, ctx);
    const entity = await demandReportService.update(id, data, ctx.organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "DemandReportSchedule",
      entityId: id,
      newData: { name: entity.name, toEmails: entity.toEmails, ccEmails: entity.ccEmails, schedule: entity.schedule },
    });
    return { success: true, id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function setReportScheduleActive(id: string, isActive: boolean) {
  const ctx = await requirePermission("report_schedules", "update");
  try {
    const entity = await demandReportService.setActive(id, isActive, ctx.organizationId);
    await auditService.log({
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entity: "DemandReportSchedule",
      entityId: id,
      newData: { name: entity.name },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteReportSchedule(id: string) {
  const ctx = await requirePermission("report_schedules", "delete");
  try {
    await demandReportService.remove(id, ctx.organizationId);
    await auditService.log({ action: "DELETE", entity: "DemandReportSchedule", entityId: id });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/** Clients that would receive the report right now — shown before "Enviar agora". */
export async function previewReportSchedule(id: string) {
  const ctx = await requirePermission("report_schedules", "read");
  const schedule = await demandReportService.getById(id, ctx.organizationId);
  if (!schedule) return { success: false as const, error: "Regra de envio não encontrada" };
  const { period, clients } = await demandReportService.previewClients(schedule);
  return {
    success: true as const,
    periodLabel: period.label,
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      to: [...schedule.toEmails, ...(schedule.sendToClientEmail && c.email ? [c.email] : [])],
    })),
    cc: schedule.ccEmails,
  };
}

export async function runReportScheduleNow(id: string) {
  const ctx = await requirePermission("report_schedules", "execute");
  try {
    const result = await demandReportService.run(id, ctx.organizationId, { manual: true, userId: ctx.userId });
    return { success: result.status === "SUCCESS" || result.status === "PARTIAL", ...result };
  } catch (e) {
    return { success: false, status: "FAILED" as const, message: (e as Error).message, sent: 0, failed: 0, skipped: 0 };
  }
}
