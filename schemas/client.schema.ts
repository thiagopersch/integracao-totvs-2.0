import { z } from "zod";
import { emailSchema, phoneSchema, documentSchema } from "@/lib/validators";

export const createClientSchema = z.object({
  image: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  legalName: z.string().max(155).optional(),
  document: documentSchema(false),
  linkCrm: z.string().optional(),
  site: z.string().optional(),
  email: emailSchema(false),
  phone: phoneSchema(false),
  responsible: z.string().max(155).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#22c55e"),
  notes: z.string().max(2000).optional(),
  favorite: z.coerce.boolean().default(false),
  status: z.boolean().default(true),
});

export const updateClientSchema = z.object({
  image: z.string().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  legalName: z.string().max(155).optional(),
  document: documentSchema(false),
  linkCrm: z.string().optional(),
  site: z.string().optional(),
  email: emailSchema(false),
  phone: phoneSchema(false),
  responsible: z.string().max(155).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
  notes: z.string().max(2000).optional(),
  favorite: z.coerce.boolean().optional(),
  status: z.boolean().optional(),
});

export type CreateClientInput = z.output<typeof createClientSchema>;
export type UpdateClientInput = z.output<typeof updateClientSchema>;
