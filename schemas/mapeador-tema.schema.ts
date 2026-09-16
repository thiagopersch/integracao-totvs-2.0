import { z } from "zod";

export const temaConfigSchema = z.object({
  corMarca: z.string().optional(),
  corBarra: z.string().optional(),
  campoCor: z.string().optional(),
  campoRaio: z.number().optional(),
  botaoCor: z.string().optional(),
  botaoRaio: z.number().optional(),
  logoUrl: z.string().nullable().optional(),
  bgImageUrl: z.string().nullable().optional(),
});

export const createMapeadorTemaSchema = z.object({
  nome: z.string().min(1, "Nome do tema é obrigatório"),
  config: temaConfigSchema,
});

export const updateMapeadorTemaSchema = z.object({
  nome: z.string().min(1).optional(),
  config: temaConfigSchema.optional(),
});

export type TemaConfigInput = z.output<typeof temaConfigSchema>;
export type CreateMapeadorTemaInput = z.output<typeof createMapeadorTemaSchema>;
export type UpdateMapeadorTemaInput = z.output<typeof updateMapeadorTemaSchema>;
