import { z } from "zod";

export const createBackupSchema = z.object({
  tbcId: z.string().min(1, "TBC é obrigatório"),
  filterId: z.string().min(1, "Filtro é obrigatório"),
  sentenceCategoryId: z.string().optional(),
  branchSentence: z.string().optional(),
  codSystem: z.string().optional(),
  codeSentence: z.string().optional(),
  nameSentence: z.string().optional(),
  contentSentence: z.string().optional(),
});

export const updateBackupSchema = z.object({
  tbcId: z.string().min(1, "TBC é obrigatório").optional(),
  filterId: z.string().min(1, "Filtro é obrigatório").optional(),
  sentenceCategoryId: z.string().optional(),
  branchSentence: z.string().optional(),
  codSystem: z.string().optional(),
  codeSentence: z.string().optional(),
  nameSentence: z.string().optional(),
  contentSentence: z.string().optional(),
});

export type CreateBackupInput = z.output<typeof createBackupSchema>;
export type UpdateBackupInput = z.output<typeof updateBackupSchema>;
