import { z } from "zod";
import { nameSchema, emailSchema, phoneSchema } from "@/lib/validators";

export const createAnalystSchema = z.object({
  name: nameSchema("Nome"),
  email: emailSchema(true),
  phone: phoneSchema(false),
  role: z.string().max(60, "Cargo deve ter no máximo 60 caracteres").optional(),
  hourlyRate: z.coerce.number().min(0.01, "Valor/hora é obrigatório"),
  team: z.string().max(60, "Time deve ter no máximo 60 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#6366f1"),
  level: z.coerce.number().int().min(1, "Nível deve ser no mínimo 1").max(5, "Nível deve ser no máximo 5"),
  status: z.coerce.boolean().default(true),
});

export const updateAnalystSchema = z.object({
  name: nameSchema("Nome").optional(),
  email: emailSchema(true),
  phone: phoneSchema(false),
  role: z.string().max(60, "Cargo deve ter no máximo 60 caracteres").optional(),
  hourlyRate: z.coerce.number().min(0.01, "Valor/hora é obrigatório"),
  team: z.string().max(60, "Time deve ter no máximo 60 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
  level: z.coerce.number().int().min(1, "Nível deve ser no mínimo 1").max(5, "Nível deve ser no máximo 5"),
  status: z.coerce.boolean().optional(),
});

export type CreateAnalystInput = z.output<typeof createAnalystSchema>;
export type UpdateAnalystInput = z.output<typeof updateAnalystSchema>;
