import { z } from "zod";
import { blockTreeSchema } from "@/lib/message-templates/block-schema";
import { allowedAttachmentTypes, TEMPLATE_ATTACHMENT_LABELS, templateAttachmentsSchema } from "@/lib/message-templates/attachments";
import { supportsAllClients } from "@/lib/message-templates/events";
import { DEFAULT_EMAIL_WIDTH, MIN_EMAIL_WIDTH } from "@/lib/message-templates/render-email";

export const messageTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome deve ter no máximo 120 caracteres"),
    channel: z.enum(["EMAIL", "WHATSAPP"]),
    event: z.enum(["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED", "GENERAL", "DEMAND_REPORT"]),
    scope: z.enum(["PER_CLIENT", "ALL_CLIENTS"]).default("PER_CLIENT"),
    subject: z.string().max(300, "Assunto deve ter no máximo 300 caracteres").default(""),
    content: blockTreeSchema.default([]),
    attachments: templateAttachmentsSchema,
    emailWidth: z
      .number()
      .int()
      .min(MIN_EMAIL_WIDTH, `A largura do e-mail deve ser de pelo menos ${MIN_EMAIL_WIDTH}px`)
      // Only the database column's (int4) bound — no product limit.
      .max(2_147_483_647, "Largura do e-mail inválida")
      .default(DEFAULT_EMAIL_WIDTH),
    bodyText: z.string().max(4096, "A mensagem do WhatsApp deve ter no máximo 4096 caracteres").default(""),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "ALL_CLIENTS" && (data.channel !== "EMAIL" || !supportsAllClients(data.event))) {
      ctx.addIssue({
        code: "custom",
        path: ["scope"],
        message: "\"Todos os clientes\" só está disponível para e-mails de relatório de demandas e de consumo de horas",
      });
    }
    if (data.channel === "EMAIL") {
      if (!data.subject.trim()) ctx.addIssue({ code: "custom", path: ["subject"], message: "Assunto é obrigatório" });
      const allowed = allowedAttachmentTypes(data.event, data.scope);
      const invalid = data.attachments.find((a) => !allowed.includes(a.type));
      if (invalid) {
        ctx.addIssue({
          code: "custom",
          path: ["attachments"],
          message: `O anexo "${TEMPLATE_ATTACHMENT_LABELS[invalid.type]}" não está disponível para este evento/escopo`,
        });
      }
      if (data.content.length === 0) {
        ctx.addIssue({ code: "custom", path: ["content"], message: "Adicione ao menos um elemento ao template" });
      }
    } else if (!data.bodyText.trim()) {
      ctx.addIssue({ code: "custom", path: ["bodyText"], message: "A mensagem é obrigatória" });
    }
  });

export type MessageTemplateInput = z.output<typeof messageTemplateSchema>;
