import { z } from "zod";

export const createTbcSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  link: z.string().min(1, "Link é obrigatório"),
  user: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
  notRequiredLicense: z.boolean().default(false),
  status: z.boolean().default(true),
});

export const updateTbcSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório").optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  link: z.string().min(1, "Link é obrigatório").optional(),
  user: z.string().min(1, "Usuário é obrigatório").optional(),
  password: z.string().optional(),
  notRequiredLicense: z.boolean().optional(),
  status: z.boolean().optional(),
});

export type CreateTbcInput = z.output<typeof createTbcSchema>;
export type UpdateTbcInput = z.output<typeof updateTbcSchema>;
