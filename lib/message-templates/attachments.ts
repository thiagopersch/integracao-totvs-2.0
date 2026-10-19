import { z } from "zod";
import { interpolate } from "./interpolate";

/**
 * Files generated and attached when an EMAIL template is sent (MessageTemplate.attachments).
 * DEMANDS_XLSX = the same spreadsheet as "Exportar demandas", filtered to the email's client and
 * reference period (only filled by sends that have one — the demands report schedules). In an
 * ALL_CLIENTS template it holds a "Resumo" sheet plus one sheet per client.
 * CONTRACT_USAGE_XLSX = hours consumption of every client/contract in the reference month
 * (ALL_CLIENTS CONTRACT_USAGE templates only).
 */
export type TemplateAttachmentType = "DEMANDS_XLSX" | "CONTRACT_USAGE_XLSX";

export interface TemplateAttachment {
  type: TemplateAttachmentType;
  /** Accepts {{variables}}; ".xlsx" is appended when missing. */
  fileName: string;
}

export const TEMPLATE_ATTACHMENT_LABELS: Record<TemplateAttachmentType, string> = {
  DEMANDS_XLSX: "Planilha de demandas (XLSX)",
  CONTRACT_USAGE_XLSX: "Planilha de consumo de horas (XLSX)",
};

export const TEMPLATE_ATTACHMENT_DESCRIPTIONS: Record<TemplateAttachmentType, string> = {
  DEMANDS_XLSX:
    "Mesma planilha do \"Exportar demandas\", gerada no envio com as demandas do cliente no período de referência da regra de envio.",
  CONTRACT_USAGE_XLSX:
    "Uma linha por cliente/contrato no mês de referência da regra de envio: horas contratadas, extras, usadas, saldo e percentual.",
};

export const DEFAULT_DEMANDS_XLSX_FILE_NAME = "demandas-{{clientName}}-{{periodSlug}}.xlsx";
export const DEFAULT_ALL_CLIENTS_DEMANDS_XLSX_FILE_NAME = "demandas-todos-os-clientes-{{periodSlug}}.xlsx";
export const DEFAULT_CONTRACT_USAGE_XLSX_FILE_NAME = "consumo-de-horas-{{periodSlug}}.xlsx";

/** Attachment types a template of this event/scope can carry. */
export function allowedAttachmentTypes(event: string, scope: string): TemplateAttachmentType[] {
  if (event === "DEMAND_REPORT") return ["DEMANDS_XLSX"];
  if (event === "CONTRACT_USAGE" && scope === "ALL_CLIENTS") return ["CONTRACT_USAGE_XLSX"];
  return [];
}

export function defaultAttachmentFileName(type: TemplateAttachmentType, scope: string): string {
  if (type === "CONTRACT_USAGE_XLSX") return DEFAULT_CONTRACT_USAGE_XLSX_FILE_NAME;
  return scope === "ALL_CLIENTS" ? DEFAULT_ALL_CLIENTS_DEMANDS_XLSX_FILE_NAME : DEFAULT_DEMANDS_XLSX_FILE_NAME;
}

export const templateAttachmentSchema = z.object({
  type: z.enum(["DEMANDS_XLSX", "CONTRACT_USAGE_XLSX"]),
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
