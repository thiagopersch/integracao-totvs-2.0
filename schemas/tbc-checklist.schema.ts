import { z } from "zod";

export const tbcChecklistNameSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(120, "Nome deve ter no máximo 120 caracteres"),
});

const optionalInt = z.number().int().nullable();

/** Contexto + processo-listing setup of the checklist screen's sidebar. */
export const tbcChecklistListingSchema = z.object({
  coligateContext: optionalInt,
  branchContext: optionalInt,
  levelEducationContext: optionalInt,
  listingDataserverCode: z.string().trim().min(1).nullable(),
  listingIdFields: z.array(z.string().trim().min(1)).max(50),
  listingLabelField: z.string().trim().min(1).nullable(),
});

export const tbcChecklistFieldSchema = z.object({
  table: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export const tbcChecklistDataserverFieldsSchema = z.object({
  dataserverCode: z.string().trim().min(1, "Data Server é obrigatório"),
  fields: z.array(tbcChecklistFieldSchema).min(1, "Selecione ao menos um campo").max(5000),
});

/** Copy another checklist's structure into this one — "merge" keeps what's there, "replace" wipes it first. */
export const tbcChecklistImportSchema = z.object({
  sourceId: z.string().uuid("Checklist de origem inválido"),
  mode: z.enum(["merge", "replace"]),
});

export type TbcChecklistListingInput = z.output<typeof tbcChecklistListingSchema>;
export type TbcChecklistField = z.output<typeof tbcChecklistFieldSchema>;
export type TbcChecklistDataserverFieldsInput = z.output<typeof tbcChecklistDataserverFieldsSchema>;
export type TbcChecklistImportInput = z.output<typeof tbcChecklistImportSchema>;
