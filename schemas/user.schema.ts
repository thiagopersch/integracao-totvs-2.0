import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  status: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  email: z.string().email("E-mail inválido").optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
  status: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
