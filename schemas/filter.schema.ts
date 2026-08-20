import { z } from "zod";

export const createFilterSchema = z.object({
  tbcId: z.string().min(1, "TBC é obrigatório"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  filter: z.string().min(1, "Filtro é obrigatório"),
  coligateContext: z.coerce.number().int(),
  branchContext: z.coerce.number().int(),
  levelEducationContext: z.coerce.number().int(),
  codSystemContext: z.string().min(1, "Código do sistema é obrigatório"),
  userContext: z.string().min(1, "Usuário é obrigatório"),
  codColigadaSentenca: z.string().max(5, "Máximo de 5 dígitos").regex(/^\d*$/, "Apenas dígitos").optional(),
  codSistemaSentenca: z.string().optional(),
  status: z.boolean().default(true),
});

export const updateFilterSchema = z.object({
  tbcId: z.string().min(1, "TBC é obrigatório").optional(),
  clientId: z.string().min(1, "Cliente é obrigatório").optional(),
  filter: z.string().min(1, "Filtro é obrigatório").optional(),
  coligateContext: z.coerce.number().int().optional(),
  branchContext: z.coerce.number().int().optional(),
  levelEducationContext: z.coerce.number().int().optional(),
  codSystemContext: z.string().min(1, "Código do sistema é obrigatório").optional(),
  userContext: z.string().min(1, "Usuário é obrigatório").optional(),
  codColigadaSentenca: z.string().max(5, "Máximo de 5 dígitos").regex(/^\d*$/, "Apenas dígitos").optional(),
  codSistemaSentenca: z.string().optional(),
  status: z.boolean().optional(),
});

export type CreateFilterInput = z.output<typeof createFilterSchema>;
export type UpdateFilterInput = z.output<typeof updateFilterSchema>;
