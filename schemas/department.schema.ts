import { z } from "zod";
import { nameSchema } from "@/lib/validators";

export const createDepartmentSchema = z.object({
  name: nameSchema("Nome"),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#f59e0b"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  requesterIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um solicitante"),
});

export const updateDepartmentSchema = z.object({
  name: nameSchema("Nome").optional(),
  description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  requesterIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um solicitante"),
});

export type CreateDepartmentInput = z.output<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;
