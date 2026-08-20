import { z } from "zod";
import { nameSchema } from "@/lib/validators";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const createDemandSchema = z.object({
  name: nameSchema("Nome"),
  description: z.string().min(1, "Descrição é obrigatória"),
  date: z.string().min(1, "Data é obrigatória"),
  durationMinutes: z.coerce.number().int().min(1, "Duração deve ser maior que zero"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  status: z.enum(STATUSES).default("PENDING"),
  notes: z.string().max(2000).optional(),
  analystId: z.string().min(1, "Analista é obrigatório"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  requesterId: z.string().optional(),
  departmentId: z.string().optional(),
  demandTypeId: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
});

export const updateDemandSchema = createDemandSchema.partial({
  name: true,
  description: true,
  date: true,
  durationMinutes: true,
  analystId: true,
  clientId: true,
});

export type CreateDemandInput = z.output<typeof createDemandSchema>;
export type UpdateDemandInput = z.output<typeof updateDemandSchema>;
