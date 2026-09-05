import { z } from "zod";
import { passwordSchema } from "@/lib/validators";

export const createUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: passwordSchema(true),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  status: z.boolean().default(true),
  changePassword: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  email: z.string().email("E-mail inválido").optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
  status: z.boolean().optional(),
  changePassword: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
