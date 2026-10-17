import { z } from "zod";
import { interpolate } from "./interpolate";

/**
 * Files generated and attached when an EMAIL template is sent (MessageTemplate.attachments).
 * DEMANDS_XLSX = the same spreadsheet as "Exportar demandas", filtered to the email's client and
 * reference period (only filled by sends that have one — the demands report schedules).
 */
export type TemplateAttachmentType = "DEMANDS_XLSX";

export interface TemplateAttachment {
  type: TemplateAttachmentType;
  /** Accepts {{variables}}; ".xlsx" is appended when missing. */
  fileName: string;
}

export const TEMPLATE_ATTACHMENT_LABELS: Record<TemplateAttachmentType, string> = {
  DEMANDS_XLSX: "Planilha de demandas (XLSX)",
};

export const TEMPLATE_ATTACHMENT_DESCRIPTIONS: Record<TemplateAttachmentType, string> = {
  DEMANDS_XLSX:
    "Mesma planilha do \"Exportar demandas\", gerada no envio com as demandas do cliente no período de referência da regra de envio.",
};

export const DEFAULT_DEMANDS_XLSX_FILE_NAME = "demandas-{{clientName}}-{{periodSlug}}.xlsx";

export const templateAttachmentSchema = z.object({
  type: z.enum(["DEMANDS_XLSX"]),
  fileName: z.string().trim().min(1, "Informe o nome do arquivo do anexo").max(150, "Nome do anexo muito longo"),
});

export const templateAttachmentsSchema = z.array(templateAttachmentSchema).max(5, "No máximo 5 anexos").default([]);

/** Tolerant reader for the JSON column — invalid entries are dropped instead of breaking a send. */
export function parseTemplateAttachments(value: unknown): TemplateAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = templateAttachmentSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Interpolates the file name and strips characters mail clients / file systems reject. */
export function resolveAttachmentFileName(template: string, vars: Record<string, string>, extension = ".xlsx"): string {
  const name = interpolate(template, vars, { escape: false })
    .replace(/[\\/:*?"<>|\r\n\t]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  const base = name || "anexo";
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}
