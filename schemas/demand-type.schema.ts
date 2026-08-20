import { z } from "zod";
import { nameSchema } from "@/lib/validators";

export const createDemandTypeSchema = z.object({
  name: nameSchema("Nome"),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#a855f7"),
});

export const updateDemandTypeSchema = z.object({
  name: nameSchema("Nome").optional(),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
});

export type CreateDemandTypeInput = z.output<typeof createDemandTypeSchema>;
export type UpdateDemandTypeInput = z.output<typeof updateDemandTypeSchema>;
