import { z } from "zod";
import { PRIORITIES, PROJECT_HEALTHS, PROJECT_STATUSES, RISK_STATUSES, TASK_STATUSES } from "@/lib/projects";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** "yyyy-MM-dd", or "" / undefined for no date. */
export const optionalDate = z
  .string()
  .regex(DATE_PATTERN, "Data inválida")
  .or(z.literal(""))
  .optional();

const longText = z.string().max(10000, "Máximo de 10.000 caracteres").optional();

export const projectSettingsSchema = z.object({
  wipLimits: z.partialRecord(z.enum(TASK_STATUSES), z.number().int().min(1).max(999)).optional(),
  wipEnforced: z.boolean().optional(),
  dueSoonDays: z.number().int().min(0).max(30).optional(),
});

export const projectSchema = z
  .object({
    code: z.string().trim().max(20, "Código deve ter no máximo 20 caracteres").optional(),
    name: z.string().trim().min(1, "Nome é obrigatório").max(150, "Nome deve ter no máximo 150 caracteres"),
    description: longText,
    objective: longText,
    scope: longText,
    outOfScope: longText,
    assumptions: longText,
    successCriteria: longText,
    clientId: z.string().optional(),
    contractId: z.string().optional(),
    managerId: z.string().optional(),
    sponsorName: z.string().trim().max(150).optional(),
    memberIds: z.array(z.string().min(1)).default([]),
    status: z.enum(PROJECT_STATUSES).default("PLANNING"),
    /** null = automático (calculado). */
    health: z.enum(PROJECT_HEALTHS).nullable().default(null),
    priority: z.enum(PRIORITIES).default("MEDIUM"),
    plannedStartDate: optionalDate,
    plannedEndDate: optionalDate,
    actualStartDate: optionalDate,
    actualEndDate: optionalDate,
    budgetHours: z.number().min(0, "Valor inválido").nullable().default(null),
    budgetAmount: z.number().min(0, "Valor inválido").nullable().default(null),
    color: z.string().regex(HEX_COLOR, "Cor inválida").default("#6366f1"),
    settings: projectSettingsSchema.default({}),
    customFields: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((v) => !v.plannedStartDate || !v.plannedEndDate || v.plannedEndDate >= v.plannedStartDate, {
    path: ["plannedEndDate"],
    message: "Término previsto deve ser igual ou posterior ao início",
  })
  .refine((v) => !v.actualStartDate || !v.actualEndDate || v.actualEndDate >= v.actualStartDate, {
    path: ["actualEndDate"],
    message: "Término real deve ser igual ou posterior ao início real",
  })
  .refine((v) => !v.contractId || !!v.clientId, {
    path: ["contractId"],
    message: "Selecione o cliente do contrato",
  });

export const projectLifecycleSchema = z.object({ status: z.enum(PROJECT_STATUSES) });

export const projectRiskSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(200),
  description: longText,
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  status: z.enum(RISK_STATUSES).default("OPEN"),
  ownerId: z.string().optional(),
  mitigationPlan: longText,
  dueDate: optionalDate,
});

export type ProjectInput = z.output<typeof projectSchema>;
export type ProjectFormValues = z.input<typeof projectSchema>;
export type ProjectRiskInput = z.output<typeof projectRiskSchema>;
export type ProjectRiskFormValues = z.input<typeof projectRiskSchema>;
