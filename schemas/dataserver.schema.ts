import { z } from "zod";

export const createDataserverSchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  nameAlternative: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

export const updateDataserverSchema = z.object({
  code: z.string().min(1, "Código é obrigatório").optional(),
  nameAlternative: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
});

export type CreateDataserverInput = z.output<typeof createDataserverSchema>;
export type UpdateDataserverInput = z.output<typeof updateDataserverSchema>;
