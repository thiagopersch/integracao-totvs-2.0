import { z } from "zod";

export const createSentenceCategorySchema = z.object({
  code: z.string().min(1, "Código é obrigatório"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  status: z.boolean().default(true),
});

export const updateSentenceCategorySchema = z.object({
  code: z.string().min(1, "Código é obrigatório").optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  status: z.boolean().optional(),
});

export type CreateSentenceCategoryInput = z.output<typeof createSentenceCategorySchema>;
export type UpdateSentenceCategoryInput = z.output<typeof updateSentenceCategorySchema>;
