import { z } from "zod";

export const createSoapEndpointTypeSchema = z.object({
  type: z.string().min(1, "Tipo é obrigatório"),
  label: z.string().min(2, "Label deve ter no mínimo 2 caracteres"),
  suffix: z.string().min(1, "Suffix é obrigatório"),
  active: z.boolean().default(true),
});

export const updateSoapEndpointTypeSchema = z.object({
  type: z.string().min(1, "Tipo é obrigatório").optional(),
  label: z.string().min(2, "Label deve ter no mínimo 2 caracteres").optional(),
  suffix: z.string().min(1, "Suffix é obrigatório").optional(),
  active: z.boolean().optional(),
});

export const createSoapEndpointMethodSchema = z.object({
  endpointTypeId: z.string().min(1, "Tipo de endpoint é obrigatório"),
  method: z.string().min(1, "Método é obrigatório"),
  label: z.string().min(2, "Label deve ter no mínimo 2 caracteres"),
  sortOrder: z.number().default(0),
  active: z.boolean().default(true),
});

export const updateSoapEndpointMethodSchema = z.object({
  endpointTypeId: z.string().min(1, "Tipo de endpoint é obrigatório").optional(),
  method: z.string().min(1, "Método é obrigatório").optional(),
  label: z.string().min(2, "Label deve ter no mínimo 2 caracteres").optional(),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
});

export type CreateSoapEndpointTypeInput = z.output<typeof createSoapEndpointTypeSchema>;
export type UpdateSoapEndpointTypeInput = z.output<typeof updateSoapEndpointTypeSchema>;
export type CreateSoapEndpointMethodInput = z.output<typeof createSoapEndpointMethodSchema>;
export type UpdateSoapEndpointMethodInput = z.output<typeof updateSoapEndpointMethodSchema>;
