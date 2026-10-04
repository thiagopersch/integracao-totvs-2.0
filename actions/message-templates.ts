"use server"

import { randomUUID } from "crypto";
import path from "path";
import { updateTag } from "next/cache";
import { messageTemplateService } from "@/services/message-template.service";
import { messageRenderService, renderEmailFromContent } from "@/services/message-render.service";
import { auditService } from "@/services/audit.service";
import { messageTemplateSchema } from "@/schemas/message-template.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";
import { storeUploadedFile } from "@/lib/upload";
import { sendEmail } from "@/lib/mailer";
import { exampleVariables } from "@/lib/message-templates/variable-catalog";
import type { BlockTree } from "@/lib/message-templates/block-types";
export async function getMessageTemplate(id: string) {
  const { organizationId } = await requirePermission("message_templates", "read");
  return messageTemplateService.getById(id, organizationId);
}

export async function createMessageTemplate(input: unknown) {
  const { organizationId } = await requirePermission("message_templates", "create");
  const parsed = messageTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const entity = await messageTemplateService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "MessageTemplate",
      entityId: entity.id,
      newData: { name: entity.name, channel: entity.channel, event: entity.event },
    });
    updateTag("message_templates");
    return { success: true, id: entity.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateMessageTemplate(id: string, input: unknown) {
  const { organizationId } = await requirePermission("message_templates", "update");
  const parsed = messageTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    const entity = await messageTemplateService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "MessageTemplate",
      entityId: id,
      newData: { name: entity.name, channel: entity.channel, event: entity.event, isActive: entity.isActive },
    });
    updateTag("message_templates");
    return { success: true, id: entity.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setMessageTemplateActive(id: string, isActive: boolean) {
  const { organizationId } = await requirePermission("message_templates", "update");
  try {
    const entity = await messageTemplateService.setActive(id, isActive, organizationId);
    await auditService.log({
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entity: "MessageTemplate",
      entityId: id,
      newData: { name: entity.name },
    });
    updateTag("message_templates");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function duplicateMessageTemplate(id: string) {
  const { organizationId } = await requirePermission("message_templates", "create");
  try {
    const entity = await messageTemplateService.duplicate(id, organizationId);
    await auditService.log({ action: "CREATE", entity: "MessageTemplate", entityId: entity.id, newData: { name: entity.name } });
    updateTag("message_templates");
    return { success: true, id: entity.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteMessageTemplate(id: string) {
  const { organizationId } = await requirePermission("message_templates", "delete");
  try {
    await messageTemplateService.remove(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "MessageTemplate", entityId: id });
    updateTag("message_templates");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteMessageTemplates(ids: string[]) {
  const { organizationId, userId } = await requirePermission("message_templates", "delete");
  try {
    const result = await messageTemplateService.bulkDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "MessageTemplate",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("MessageTemplate", result.blocked, organizationId, userId);
    }
    updateTag("message_templates");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Sends a saved EMAIL template to the logged-in user's own address, filled with the catalog's
 * example values and prefixed with "[Teste]" — so the layout can be checked in a real inbox.
 */
export async function sendTestMessageTemplate(id: string) {
  const { organizationId, userId, email } = await requirePermission("message_templates", "read");
  const template = await messageTemplateService.getById(id, organizationId);
  if (!template) return { success: false, error: "Template não encontrado" };
  if (template.channel !== "EMAIL") {
    return { success: false, error: "O envio de WhatsApp ainda não está integrado — use a pré-visualização." };
  }
  if (!email) return { success: false, error: "Seu usuário não tem e-mail cadastrado" };

  // Example values, but the real system address/dates/organization so links and headers are testable.
  const base = await messageRenderService.baseVars(organizationId);
  const real = ["appUrl", "currentDate", "currentDateTime", "currentMonth", "organizationName", "organizationDocument"] as const;
  const vars = { ...exampleVariables(), ...Object.fromEntries(real.map((k) => [k, base[k]])), recipientEmail: email };
  const rendered = renderEmailFromContent(template.subject, (template.content ?? []) as unknown as BlockTree, vars);
  const status = await sendEmail(organizationId, email, `[Teste] ${rendered.subject}`, rendered.text, userId, {
    html: rendered.html,
  });
  if (status === "SENT") return { success: true, message: `E-mail de teste enviado para ${email}` };
  if (status === "SKIPPED") {
    return { success: false, error: "Envio de e-mail desativado — configure o SMTP em Integrações > E-mail." };
  }
  return { success: false, error: "Falha ao enviar o e-mail de teste — veja o registro em Atividades." };
}

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export async function uploadMessageTemplateImage(formData: FormData) {
  await requirePermission("message_templates", "update");
  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false as const, error: "Nenhum arquivo enviado" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { success: false as const, error: "Formato não suportado (use PNG, JPEG, WEBP ou GIF)" };
  }
  if (file.size > MAX_IMAGE_SIZE) return { success: false as const, error: "Imagem maior que 2MB" };
  try {
    const ext = path.extname(file.name) || ".png";
    const url = await storeUploadedFile(file, `message-templates/${randomUUID()}${ext}`);
    return { success: true as const, url };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
