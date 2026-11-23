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

export type DictionaryEntryInput = z.input<typeof dictionaryEntrySchema>;
