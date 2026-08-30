import { z } from "zod";

const CONTRACT_STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"] as const;

export const createContractSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  contractedHours: z.coerce.number().min(0.01, "Horas contratadas devem ser maiores que zero"),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  endDate: z.string().optional(),
  status: z.enum(CONTRACT_STATUSES),
  notes: z.string().max(2000, "Observações devem ter no máximo 2000 caracteres").optional(),
});

export const updateContractSchema = createContractSchema.partial({
  clientId: true,
  contractedHours: true,
  startDate: true,
});

export type CreateContractInput = z.output<typeof createContractSchema>;
export type UpdateContractInput = z.output<typeof updateContractSchema>;
