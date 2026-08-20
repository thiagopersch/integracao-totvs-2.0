import { z } from "zod";
import { nameSchema } from "@/lib/validators";

export const createTagSchema = z.object({
  name: nameSchema("Nome"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#8b5cf6"),
});

export const updateTagSchema = z.object({
  name: nameSchema("Nome").optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional(),
});

export type CreateTagInput = z.output<typeof createTagSchema>;
export type UpdateTagInput = z.output<typeof updateTagSchema>;
