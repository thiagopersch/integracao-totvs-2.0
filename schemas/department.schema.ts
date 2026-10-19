import { z } from "zod";
import { nameSchema } from "@/lib/validators";

export const createDepartmentSchema = z.object({
  name: nameSchema("Nome"),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#f59e0b"),
});

export const updateDepartmentSchema = z.object({
  name: nameSchema("Nome").optional(),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
});

export type CreateDepartmentInput = z.output<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;
