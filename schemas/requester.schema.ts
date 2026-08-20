import { z } from "zod";
import { nameSchema, emailSchema, phoneSchema } from "@/lib/validators";

export const createRequesterSchema = z.object({
  name: nameSchema("Nome"),
  email: emailSchema(false),
  phone: phoneSchema(false),
  status: z.coerce.boolean().default(true),
});

export const updateRequesterSchema = z.object({
  name: nameSchema("Nome").optional(),
  email: emailSchema(false),
  phone: phoneSchema(false),
  status: z.coerce.boolean().optional(),
});

export type CreateRequesterInput = z.output<typeof createRequesterSchema>;
export type UpdateRequesterInput = z.output<typeof updateRequesterSchema>;
