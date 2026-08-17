import { z } from "zod";

export const createClientSchema = z.object({
  image: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  linkCrm: z.string().min(1, "Link CRM é obrigatório"),
  site: z.string().optional(),
  status: z.boolean().default(true),
});

export const updateClientSchema = z.object({
  image: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  linkCrm: z.string().min(1, "Link CRM é obrigatório").optional(),
  site: z.string().optional(),
  status: z.boolean().optional(),
});

export type CreateClientInput = z.output<typeof createClientSchema>;
export type UpdateClientInput = z.output<typeof updateClientSchema>;
