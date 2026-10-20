import { z } from "zod";
import { nameSchema, emailSchema, phoneSchema } from "@/lib/validators";

export const createRequesterSchema = z.object({
  name: nameSchema("Nome"),
  email: emailSchema(false),
  phone: phoneSchema(false),
  status: z.coerce.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#0ea5e9"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
});

export const updateRequesterSchema = z.object({
  name: nameSchema("Nome").optional(),
  email: emailSchema(false),
  phone: phoneSchema(false),
  status: z.coerce.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
  clientId: z.string().min(1, "Cliente é obrigatório"),
});

export type CreateRequesterInput = z.output<typeof createRequesterSchema>;
export type UpdateRequesterInput = z.output<typeof updateRequesterSchema>;
