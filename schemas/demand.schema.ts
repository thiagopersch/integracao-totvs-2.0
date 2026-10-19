import { z } from "zod";
import { nameSchema } from "@/lib/validators";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export const createDemandSchema = z
  .object({
    name: nameSchema("Nome"),
    description: z.string().min(1, "Descrição é obrigatória"),
    date: z.string().min(1, "Data é obrigatória"),
    startTime: z.string().regex(TIME_REGEX, "Hora de início inválida"),
    endTime: z.string().regex(TIME_REGEX, "Hora de término inválida"),
    priority: z.enum(PRIORITIES).default("MEDIUM"),
    status: z.enum(STATUSES).default("PENDING"),
    notes: z.string().max(2000).optional(),
    analystIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um analista"),
    clientId: z.string().min(1, "Cliente é obrigatório"),
    requesterIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um solicitante"),
    departmentIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um departamento"),
    demandTypeIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um tipo"),
    tagIds: z.array(z.string()).default([]),
    /** Gestão de Projetos: project (must be of the same client) and, optionally, one of its tasks. */
    projectId: z.string().optional(),
    projectTaskId: z.string().optional(),
  })
  .refine((data) => !data.projectTaskId || !!data.projectId, { message: "Selecione o projeto da tarefa", path: ["projectTaskId"] })
  .refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
    message: "Hora de término deve ser depois da hora de início",
    path: ["endTime"],
  });

export const updateDemandSchema = z
  .object({
    name: nameSchema("Nome").optional(),
    description: z.string().min(1, "Descrição é obrigatória").optional(),
    date: z.string().min(1, "Data é obrigatória").optional(),
    startTime: z.string().regex(TIME_REGEX, "Hora de início inválida").optional(),
    endTime: z.string().regex(TIME_REGEX, "Hora de término inválida").optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(STATUSES).optional(),
    notes: z.string().max(2000).optional(),
    analystIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um analista").optional(),
    clientId: z.string().min(1, "Cliente é obrigatório").optional(),
    requesterIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um solicitante").optional(),
    departmentIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um departamento").optional(),
    demandTypeIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um tipo").optional(),
    tagIds: z.array(z.string()).default([]),
    /** "" clears the link; undefined keeps it. */
    projectId: z.string().optional(),
    projectTaskId: z.string().optional(),
  })
  .refine((data) => !data.startTime || !data.endTime || timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
    message: "Hora de término deve ser depois da hora de início",
    path: ["endTime"],
  });

export type CreateDemandInput = z.output<typeof createDemandSchema>;
export type UpdateDemandInput = z.output<typeof updateDemandSchema>;
