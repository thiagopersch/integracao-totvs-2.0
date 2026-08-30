import { z } from "zod";

export const backupScheduleSchema = z.enum(["NONE", "EVERY_3H", "EVERY_6H", "EVERY_12H", "DAILY", "WEEKLY", "MONTHLY"]);

const SCHEDULES_WITH_TIME_OF_DAY = new Set(["DAILY", "WEEKLY", "MONTHLY"]);

/** Whenever a schedule other than NONE is picked, the run needs both a category and a fixed run time. */
function requireScheduleFields(data: { schedule?: string; scheduleTime?: string; scheduleCategoryId?: string }, ctx: z.RefinementCtx) {
  if (!data.schedule || data.schedule === "NONE") return;
  if (!data.scheduleCategoryId) {
    ctx.addIssue({ code: "custom", path: ["scheduleCategoryId"], message: "Categoria é obrigatória para agendar a execução" });
  }
  if (SCHEDULES_WITH_TIME_OF_DAY.has(data.schedule) && !data.scheduleTime) {
    ctx.addIssue({ code: "custom", path: ["scheduleTime"], message: "Horário é obrigatório para este agendamento" });
  }
}

export const createFilterSchema = z
  .object({
    tbcId: z.string().min(1, "TBC é obrigatório"),
    clientId: z.string().min(1, "Cliente é obrigatório"),
    filter: z.string().min(1, "Filtro é obrigatório"),
    coligateContext: z.coerce.number().int(),
    branchContext: z.coerce.number().int(),
    levelEducationContext: z.coerce.number().int(),
    codSystemContext: z.string().min(1, "Código do sistema é obrigatório"),
    userContext: z.string().min(1, "Usuário é obrigatório"),
    codColigadaSentenca: z
      .string()
      .min(1, "Cód. Coligada Sentença é obrigatório")
      .max(5, "Máximo de 5 dígitos")
      .regex(/^\d*$/, "Apenas dígitos"),
    codSistemaSentenca: z.string().min(1, "Cód. Sistema Sentença é obrigatório"),
    status: z.boolean().default(true),
    schedule: backupScheduleSchema.default("NONE"),
    scheduleTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido")
      .optional()
      .or(z.literal("")),
    scheduleCategoryId: z.string().optional().or(z.literal("")),
  })
  .superRefine(requireScheduleFields);

export const updateFilterSchema = z
  .object({
    tbcId: z.string().min(1, "TBC é obrigatório").optional(),
    clientId: z.string().min(1, "Cliente é obrigatório").optional(),
    filter: z.string().min(1, "Filtro é obrigatório").optional(),
    coligateContext: z.coerce.number().int().optional(),
    branchContext: z.coerce.number().int().optional(),
    levelEducationContext: z.coerce.number().int().optional(),
    codSystemContext: z.string().min(1, "Código do sistema é obrigatório").optional(),
    userContext: z.string().min(1, "Usuário é obrigatório").optional(),
    codColigadaSentenca: z
      .string()
      .min(1, "Cód. Coligada Sentença é obrigatório")
      .max(5, "Máximo de 5 dígitos")
      .regex(/^\d*$/, "Apenas dígitos")
      .optional(),
    codSistemaSentenca: z.string().min(1, "Cód. Sistema Sentença é obrigatório").optional(),
    status: z.boolean().optional(),
    schedule: backupScheduleSchema.optional(),
    scheduleTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido")
      .optional()
      .or(z.literal("")),
    scheduleCategoryId: z.string().optional().or(z.literal("")),
  })
  .superRefine(requireScheduleFields);

export type CreateFilterInput = z.output<typeof createFilterSchema>;
export type UpdateFilterInput = z.output<typeof updateFilterSchema>;
