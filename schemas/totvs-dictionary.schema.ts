import { z } from "zod";

const identifier = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} é obrigatório`)
    .max(128, `${label} muito longo`)
    .refine((v) => !v.includes("|"), `${label} não pode conter "|"`)
    .transform((v) => v.toUpperCase());

export const dictionaryEntrySchema = z.object({
  table: identifier("Tabela"),
  column: identifier("Coluna"),
  description: z.string().trim().max(2000, "Descrição muito longa").default(""),
});

/** Rows per request of the import — keeps each JSON body far below the 4.5 MB serverless limit. */
export const DICTIONARY_IMPORT_BATCH = 5000;

export const dictionaryImportStepSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("start"), mode: z.enum(["merge", "replace"]), fileName: z.string().max(255), total: z.number().int().min(1) }),
  z.object({ step: z.literal("batch"), rows: z.array(dictionaryEntrySchema).min(1).max(DICTIONARY_IMPORT_BATCH * 2) }),
  z.object({
    step: z.literal("finish"),
    mode: z.enum(["merge", "replace"]),
    startedAt: z.iso.datetime(),
    fileName: z.string().max(255),
    read: z.number().int().min(0),
    skipped: z.number().int().min(0),
    inserted: z.number().int().min(0),
    updated: z.number().int().min(0),
  }),
]);

export type DictionaryImportStep = z.infer<typeof dictionaryImportStepSchema>;

export type DictionaryEntryInput = z.input<typeof dictionaryEntrySchema>;
