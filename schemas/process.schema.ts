import { z } from "zod";

export const createProcessSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  nameAlternative: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

export const updateProcessSchema = z.object({
  code: z.string().min(1, "Código é obrigatório").optional(),
  nameAlternative: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
});

export type CreateProcessInput = z.output<typeof createProcessSchema>;
export type UpdateProcessInput = z.output<typeof updateProcessSchema>;
