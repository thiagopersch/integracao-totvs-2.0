import { z } from "zod";

export const createSentenceSchema = z.object({
  sentenceCategoryId: z.string().min(1, "Categoria é obrigatória"),
  code: z.string().min(1, "Código é obrigatório").max(16, "Máximo de 16 caracteres"),
  codSystem: z.string().max(2, "Máximo de 2 caracteres").optional(),
  codColigada: z.string().max(5, "Máximo de 5 caracteres").optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255, "Máximo de 255 caracteres"),
  content: z.string().optional(),
  status: z.boolean().default(true),
});

export const updateSentenceSchema = z.object({
  sentenceCategoryId: z.string().min(1, "Categoria é obrigatória").optional(),
  code: z.string().min(1, "Código é obrigatório").max(16, "Máximo de 16 caracteres").optional(),
  codSystem: z.string().max(2, "Máximo de 2 caracteres").optional(),
  codColigada: z.string().max(5, "Máximo de 5 caracteres").optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(255, "Máximo de 255 caracteres").optional(),
  content: z.string().optional(),
  status: z.boolean().optional(),
});

export type CreateSentenceInput = z.output<typeof createSentenceSchema>;
export type UpdateSentenceInput = z.output<typeof updateSentenceSchema>;
