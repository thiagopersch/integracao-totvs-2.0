import { z } from "zod";
import { REPORT_PERIOD_KINDS } from "@/lib/report-period";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const emailList = (label: string) =>
  z
    .array(z.string().trim().toLowerCase().email(`${label}: e-mail inválido`))
    .max(20, `${label}: no máximo 20 e-mails`)
    .default([])
    .transform((list) => [...new Set(list)]);

export const demandReportScheduleSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome deve ter no máximo 120 caracteres"),
    templateId: z.string().min(1, "Selecione o template de e-mail"),
    period: z.enum(REPORT_PERIOD_KINDS as [string, ...string[]]).default("currentMonth"),
    clientIds: z.array(z.string()).default([]),
    toEmails: emailList("Para"),
    ccEmails: emailList("Cópia (CC)"),
    sendToClientEmail: z.boolean().default(false),
    schedule: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("MONTHLY"),
    scheduleTime: z.string().regex(TIME_REGEX, "Horário inválido").nullable().default("08:00"),
    dayOfMonth: z.number().int().min(1).max(31).nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.toEmails.length > 0 || d.sendToClientEmail, {
    message: "Informe ao menos um destinatário (Para) ou marque \"Enviar também ao e-mail do cliente\"",
    path: ["toEmails"],
  });

export type DemandReportScheduleInput = z.output<typeof demandReportScheduleSchema>;
