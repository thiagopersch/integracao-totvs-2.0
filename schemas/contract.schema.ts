import { z } from "zod";

const CONTRACT_STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"] as const;

export const createContractSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  contractedHours: z.coerce.number().min(0.01, "Horas contratadas devem ser maiores que zero"),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  endDate: z.string().optional(),
  status: z.enum(CONTRACT_STATUSES),
  notifyClient: z.boolean().default(false),
  notes: z.string().max(2000, "Observações devem ter no máximo 2000 caracteres").optional(),
});

export const updateContractSchema = createContractSchema.partial({
  clientId: true,
  contractedHours: true,
  startDate: true,
});

export const addExtraHoursSchema = z.object({
  contractId: z.string().min(1, "Contrato é obrigatório"),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido"),
  hours: z.coerce.number().min(0.01, "Horas devem ser maiores que zero").max(10000, "Horas demais"),
  notes: z.string().max(2000, "Observações devem ter no máximo 2000 caracteres").optional(),
});

export type CreateContractInput = z.output<typeof createContractSchema>;
export type UpdateContractInput = z.output<typeof updateContractSchema>;
export type AddExtraHoursInput = z.output<typeof addExtraHoursSchema>;
