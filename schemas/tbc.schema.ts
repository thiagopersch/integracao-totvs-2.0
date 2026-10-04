import { z } from "zod";

// The server sends the stored credentials to this link — only plain http(s) hosts (scheme-less
// "host:port/path" values are still accepted, as already stored ones may look like that).
const tbcLink = z
  .string()
  .min(1, "Link é obrigatório")
  .refine((v) => !/^(file|data|javascript|gopher|ftp|ws|wss|dict|ldap):/i.test(v.trim()) && (!v.includes("://") || /^https?:\/\//i.test(v.trim())), {
    message: "O link deve usar http:// ou https://",
  });

export const createTbcSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  link: tbcLink,
  user: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
  notRequiredLicense: z.boolean().default(false),
  status: z.boolean().default(true),
});

export const updateTbcSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório").optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  link: tbcLink.optional(),
  user: z.string().min(1, "Usuário é obrigatório").optional(),
  password: z.string().optional(),
  notRequiredLicense: z.boolean().optional(),
  status: z.boolean().optional(),
});

export type CreateTbcInput = z.output<typeof createTbcSchema>;
export type UpdateTbcInput = z.output<typeof updateTbcSchema>;
