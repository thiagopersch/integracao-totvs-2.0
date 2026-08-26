import { z } from "zod";

export const backupScheduleSchema = z.enum(["NONE", "EVERY_3H", "EVERY_6H", "EVERY_12H", "DAILY", "WEEKLY", "MONTHLY"]);

export const createFilterSchema = z.object({
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
});

export const updateFilterSchema = z.object({
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
});

export type CreateFilterInput = z.output<typeof createFilterSchema>;
export type UpdateFilterInput = z.output<typeof updateFilterSchema>;
