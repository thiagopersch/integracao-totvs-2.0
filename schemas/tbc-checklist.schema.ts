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

/** One link of a checklist Data Server to another of the same checklist (`parentCode`): pairs of
 *  main-table columns, the parent's ↔ this one's. */
export const tbcChecklistLinkSchema = z.object({
  parentCode: z.string().trim().min(1, "Data Server vinculado é obrigatório"),
  fields: z
    .array(
      z.object({
        parent: z.string().trim().min(1, "Campo do Data Server vinculado é obrigatório"),
        child: z.string().trim().min(1, "Campo deste Data Server é obrigatório"),
      })
    )
    .min(1, "Escolha ao menos um par de campos para cada vínculo")
    .max(10),
});

export const tbcChecklistDataserverLinksSchema = z.object({
  dataserverCode: z.string().trim().min(1, "Data Server é obrigatório"),
  links: z.array(tbcChecklistLinkSchema).max(10, "No máximo 10 vínculos por Data Server"),
});

/** The checklist's Data Servers in their new order (every code, once). */
export const tbcChecklistReorderSchema = z.object({
  dataserverCodes: z.array(z.string().trim().min(1)).min(1).max(200),
});

/** A processo seletivo saved in the checklist — coligada + IDPS identify it, filial + nível de
 *  ensino complete the Contexto it is loaded with. */
export const tbcChecklistProcessoSchema = z.object({
  codColigada: z.number().int(),
  codFilial: z.number().int(),
  levelEducation: z.number().int(),
  idps: z.number().int(),
  name: z.string().trim().min(1, "Nome do processo seletivo é obrigatório").max(255),
});

export const tbcChecklistAddProcessosSchema = z.object({
  processos: z.array(tbcChecklistProcessoSchema).min(1, "Selecione ao menos um processo seletivo").max(500),
});

/** Copy another checklist's structure into this one — "merge" keeps what's there, "replace" wipes it first. */
export const tbcChecklistImportSchema = z.object({
  sourceId: z.string().uuid("Checklist de origem inválido"),
  mode: z.enum(["merge", "replace"]),
});

export type TbcChecklistListingInput = z.output<typeof tbcChecklistListingSchema>;
export type TbcChecklistField = z.output<typeof tbcChecklistFieldSchema>;
export type TbcChecklistDataserverFieldsInput = z.output<typeof tbcChecklistDataserverFieldsSchema>;
export type TbcChecklistLink = z.output<typeof tbcChecklistLinkSchema>;
export type TbcChecklistDataserverLinksInput = z.output<typeof tbcChecklistDataserverLinksSchema>;
export type TbcChecklistReorderInput = z.output<typeof tbcChecklistReorderSchema>;
export type TbcChecklistProcessoInput = z.output<typeof tbcChecklistProcessoSchema>;
export type TbcChecklistAddProcessosInput = z.output<typeof tbcChecklistAddProcessosSchema>;
export type TbcChecklistImportInput = z.output<typeof tbcChecklistImportSchema>;
