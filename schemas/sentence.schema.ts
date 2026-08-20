import { z } from "zod";

export const createSentenceSchema = z.object({
  sentenceCategoryId: z.string().min(1, "Categoria é obrigatória"),
  code: z.string().min(1, "Código é obrigatório"),
  codSystem: z.string().optional(),
  codColigada: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  content: z.string().optional(),
  status: z.boolean().default(true),
});

export const updateSentenceSchema = z.object({
  sentenceCategoryId: z.string().min(1, "Categoria é obrigatória").optional(),
  code: z.string().min(1, "Código é obrigatório").optional(),
  codSystem: z.string().optional(),
  codColigada: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  content: z.string().optional(),
  status: z.boolean().optional(),
});

export type CreateSentenceInput = z.output<typeof createSentenceSchema>;
export type UpdateSentenceInput = z.output<typeof updateSentenceSchema>;
