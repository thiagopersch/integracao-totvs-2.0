import { z } from "zod";
import { nameSchema } from "@/lib/validators";

export const createDepartmentSchema = z.object({
  name: nameSchema("Nome"),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
});

export const updateDepartmentSchema = z.object({
  name: nameSchema("Nome").optional(),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
});

export type CreateDepartmentInput = z.output<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;
