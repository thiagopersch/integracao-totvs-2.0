import { z } from "zod";

export const createSistemaSchema = z.object({
  code: z.string().min(1, "Código é obrigatório").max(5, "Código deve ter no máximo 5 caracteres"),
  internalName: z.string().min(2, "Nome interno deve ter no mínimo 2 caracteres"),
  externalName: z.string().min(2, "Nome externo deve ter no mínimo 2 caracteres"),
});

export const updateSistemaSchema = z.object({
  code: z.string().min(1, "Código é obrigatório").max(5, "Código deve ter no máximo 5 caracteres").optional(),
  internalName: z.string().min(2, "Nome interno deve ter no mínimo 2 caracteres").optional(),
  externalName: z.string().min(2, "Nome externo deve ter no mínimo 2 caracteres").optional(),
});

export type CreateSistemaInput = z.output<typeof createSistemaSchema>;
export type UpdateSistemaInput = z.output<typeof updateSistemaSchema>;
