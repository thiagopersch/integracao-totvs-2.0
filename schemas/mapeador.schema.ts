import { z } from "zod";

export const createMapeadorProjetoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

export const renameMapeadorProjetoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

export const updateInformacoesAdicionaisSchema = z.record(z.string(), z.string().optional());

export const updatePrototipoConfigSchema = z.object({
  temaId: z.string().nullable().optional(),
  corMarca: z.string().optional(),
  corBarra: z.string().optional(),
  visualizacao: z.enum(["desktop", "mobile"]).optional(),
  logoUrl: z.string().nullable().optional(),
  bgImageUrl: z.string().nullable().optional(),
  textos: z.record(z.string(), z.string()).optional(),
  gerarPara: z.enum(["atual", "todos"]).optional(),
  exportVisualizacao: z.enum(["desktop", "mobile"]).optional(),
});

export const createEtapaSchema = z.object({
  nome: z.string().min(1, "Nome da etapa é obrigatório"),
});

export const updateEtapaSchema = z.object({
  nome: z.string().min(1).optional(),
  condicao: z.string().nullable().optional(),
  regras: z.string().nullable().optional(),
  camposPorEtapa: z.array(z.any()).optional(),
  feedbacks: z.array(z.any()).optional(),
});

export const reorderEtapasSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export type CreateMapeadorProjetoInput = z.output<typeof createMapeadorProjetoSchema>;
export type RenameMapeadorProjetoInput = z.output<typeof renameMapeadorProjetoSchema>;
export type UpdateInformacoesAdicionaisInput = z.output<typeof updateInformacoesAdicionaisSchema>;
export type UpdatePrototipoConfigInput = z.output<typeof updatePrototipoConfigSchema>;
export type CreateEtapaInput = z.output<typeof createEtapaSchema>;
export type UpdateEtapaInput = z.output<typeof updateEtapaSchema>;
