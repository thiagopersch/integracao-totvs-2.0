import { z } from "zod";

const required = (label: string) => z.string().trim().min(1, `${label} é obrigatório`);
const integerId = (label: string) => required(label).regex(/^\d+$/, "Informe apenas números inteiros");
const urlLink = z
  .string()
  .trim()
  .min(1, "Link do CRM é obrigatório")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Informe um link válido (ex: https://crm.exemplo.com.br/)");

const credentials = {
  branch: required("Branch"),
  clientId: required("client_id"),
  session: required("inscricoes_session"),
  xsrf: required("XSRF-TOKEN"),
};

export const psDocsProcessoSchema = z.object({
  docMode: z.literal("processo"),
  ...credentials,
  idPs: integerId("ID do Processo Seletivo no I&M"),
  crmDomain: urlLink,
  idPortal: z.string(),
  localId: z.string(),
});

export const psDocsPortalSchema = z.object({
  docMode: z.literal("portal"),
  ...credentials,
  idPortal: integerId("ID do portal no I&M"),
  crmDomain: urlLink,
  localId: integerId("Local ID"),
  idPs: z.string(),
});

export const psDocsSchema = z.discriminatedUnion("docMode", [psDocsProcessoSchema, psDocsPortalSchema]);

export type PsDocsFormInput = z.infer<typeof psDocsSchema>;
