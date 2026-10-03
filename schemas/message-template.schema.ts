import { z } from "zod";
import { blockTreeSchema } from "@/lib/message-templates/block-schema";

export const messageTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome deve ter no máximo 120 caracteres"),
    channel: z.enum(["EMAIL", "WHATSAPP"]),
    event: z.enum(["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED", "GENERAL"]),
    subject: z.string().max(300, "Assunto deve ter no máximo 300 caracteres").default(""),
    content: blockTreeSchema.default([]),
    bodyText: z.string().max(4096, "A mensagem do WhatsApp deve ter no máximo 4096 caracteres").default(""),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "EMAIL") {
      if (!data.subject.trim()) ctx.addIssue({ code: "custom", path: ["subject"], message: "Assunto é obrigatório" });
      if (data.content.length === 0) {
        ctx.addIssue({ code: "custom", path: ["content"], message: "Adicione ao menos um elemento ao template" });
      }
    } else if (!data.bodyText.trim()) {
      ctx.addIssue({ code: "custom", path: ["bodyText"], message: "A mensagem é obrigatória" });
    }
  });

export type MessageTemplateInput = z.output<typeof messageTemplateSchema>;
