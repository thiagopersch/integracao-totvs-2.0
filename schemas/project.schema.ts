import { z } from "zod";
import {
  PRIORITIES,
  PROJECT_HEALTHS,
  PROJECT_STATUSES,
  RISK_STATUSES,
  TASK_STATUSES,
  WORKSPACE_VIEWS,
} from "@/lib/projects";
import { buildCustomFieldsSchema, type CustomFieldDef } from "@/lib/custom-fields";

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
  wipEnforced: z.boolean().optional(),
  dueSoonDays: z.number().int().min(0, "Mínimo 0").max(30, "Máximo 30 dias").optional(),
  enabledViews: z.array(z.enum(WORKSPACE_VIEWS)).min(1, "Escolha ao menos uma visualização"),
  defaultView: z.enum(WORKSPACE_VIEWS),
});

/** Workflow stage (kanban column). `id` present = existing stage being edited. */
export const projectStageInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Informe o nome da etapa").max(60, "Máximo de 60 caracteres"),
  color: z.string().regex(HEX_COLOR, "Cor inválida"),
  category: z.enum(TASK_STATUSES),
  wipLimit: z.number().int("Informe um número inteiro").min(1, "Mínimo 1").max(999).nullable().default(null),
});

export const projectPhaseInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Informe o nome da fase").max(80, "Máximo de 80 caracteres"),
    color: z.string().regex(HEX_COLOR, "Cor inválida"),
    description: z.string().max(2000).optional(),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine((p) => !p.startDate || !p.endDate || p.endDate >= p.startDate, {
    path: ["endDate"],
    message: "Fim deve ser igual ou posterior ao início",
  });

/** Field shape without cross-field rules — extended with typed custom fields by the form. */
export const projectBaseSchema = z.object({
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
  settings: projectSettingsSchema,
  stages: z.array(projectStageInputSchema).min(1, "Defina ao menos uma etapa"),
  phases: z.array(projectPhaseInputSchema).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

type ProjectBase = z.output<typeof projectBaseSchema>;

function projectRules(v: Omit<ProjectBase, "customFields">, ctx: z.RefinementCtx) {
  if (v.plannedStartDate && v.plannedEndDate && v.plannedEndDate < v.plannedStartDate) {
    ctx.addIssue({ code: "custom", path: ["plannedEndDate"], message: "Término previsto deve ser igual ou posterior ao início" });
  }
  if (v.actualStartDate && v.actualEndDate && v.actualEndDate < v.actualStartDate) {
    ctx.addIssue({ code: "custom", path: ["actualEndDate"], message: "Término real deve ser igual ou posterior ao início real" });
  }
  if (v.contractId && !v.clientId) {
    ctx.addIssue({ code: "custom", path: ["contractId"], message: "Selecione o cliente do contrato" });
  }
  if (!v.stages.some((s) => s.category === "DONE")) {
    ctx.addIssue({ code: "custom", path: ["stages"], message: "Inclua ao menos uma etapa do tipo “Concluída”" });
  }
  const names = new Set<string>();
  for (const stage of v.stages) {
    const key = stage.name.toLocaleLowerCase("pt-BR");
    if (names.has(key)) {
      ctx.addIssue({ code: "custom", path: ["stages"], message: `Etapa “${stage.name}” repetida` });
      break;
    }
    names.add(key);
  }
  if (!v.settings.enabledViews.includes(v.settings.defaultView)) {
    ctx.addIssue({ code: "custom", path: ["settings", "defaultView"], message: "A visualização padrão precisa estar habilitada" });
  }
}

export const projectSchema = projectBaseSchema.superRefine(projectRules);

/** Client form schema: same rules + the active custom fields typed and validated per definition. */
export function buildProjectFormSchema(defs: CustomFieldDef[]) {
  return projectBaseSchema.extend({ customFields: buildCustomFieldsSchema(defs) }).superRefine(projectRules);
}

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
export type ProjectStageInput = z.output<typeof projectStageInputSchema>;
export type ProjectPhaseInput = z.output<typeof projectPhaseInputSchema>;
export type ProjectRiskInput = z.output<typeof projectRiskSchema>;
export type ProjectRiskFormValues = z.input<typeof projectRiskSchema>;
