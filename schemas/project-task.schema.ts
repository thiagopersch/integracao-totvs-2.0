import { z } from "zod";
import { PRIORITIES } from "@/lib/projects";
import { buildCustomFieldsSchema, type CustomFieldDef } from "@/lib/custom-fields";
import { optionalDate } from "@/schemas/project.schema";

/** Field shape without cross-field rules — the form extends it with typed custom fields. */
export const projectTaskBaseSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(300, "Título deve ter no máximo 300 caracteres"),
  description: z.string().max(20000, "Máximo de 20.000 caracteres").optional(),
  /** Workflow stage (kanban column) — the task status follows the stage category. */
  stageId: z.string().min(1, "Selecione a etapa"),
  phaseId: z.string().optional(),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  assigneeId: z.string().optional(),
  parentId: z.string().optional(),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimateHours: z.number().min(0, "Valor inválido").max(100000).nullable().default(null),
  progress: z.number().int().min(0).max(100).default(0),
  isMilestone: z.boolean().default(false),
  tagIds: z.array(z.string().min(1)).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

function taskRules(v: { startDate?: string; dueDate?: string }, ctx: z.RefinementCtx) {
  if (v.startDate && v.dueDate && v.dueDate < v.startDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Prazo deve ser igual ou posterior ao início" });
  }
}

export const projectTaskSchema = projectTaskBaseSchema.superRefine(taskRules);

/** Client form schema: same rules + the active task custom fields validated per definition. */
export function buildTaskFormSchema(defs: CustomFieldDef[]) {
  return projectTaskBaseSchema.extend({ customFields: buildCustomFieldsSchema(defs) }).superRefine(taskRules);
}

const patchDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").nullable().optional();

/**
 * Inline edit of a single property (task sheet, Notion-style). Absent = keep, null = clear. The
 * service merges it with the stored task and runs the same validations as the full form.
 */
export const projectTaskPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Título é obrigatório").max(300, "Título deve ter no máximo 300 caracteres").optional(),
    description: z.string().max(20000, "Máximo de 20.000 caracteres").nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    phaseId: z.string().min(1).nullable().optional(),
    startDate: patchDate,
    dueDate: patchDate,
    estimateHours: z.number().min(0, "Valor inválido").max(100000).nullable().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    isMilestone: z.boolean().optional(),
    tagIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** Kanban/list inline creation — only a title (and the column it was created in). */
export const quickTaskSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(300),
  /** Column it was created in; defaults to the project's first "a fazer" stage. */
  stageId: z.string().optional(),
  parentId: z.string().optional(),
  dueDate: optionalDate,
});

export const moveTaskSchema = z.object({
  stageId: z.string().min(1),
  /** Card right above the drop position in the target column (null = top). */
  beforeId: z.string().nullable().optional(),
  /** Card right below the drop position (null = bottom). */
  afterId: z.string().nullable().optional(),
});

export const rescheduleTaskSchema = z
  .object({ startDate: optionalDate, dueDate: optionalDate })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    path: ["dueDate"],
    message: "Prazo deve ser igual ou posterior ao início",
  });

export const dependencySchema = z.object({
  predecessorId: z.string().min(1),
  successorId: z.string().min(1),
  lagDays: z.number().int().min(-365).max(365).default(0),
});

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1, "Informe o item").max(300),
});

export const taskCommentSchema = z.object({
  content: z.string().trim().min(1, "Escreva um comentário").max(5000, "Máximo de 5.000 caracteres"),
});

export type ProjectTaskInput = z.output<typeof projectTaskSchema>;
export type ProjectTaskFormValues = z.input<typeof projectTaskSchema>;
export type QuickTaskInput = z.output<typeof quickTaskSchema>;
export type ProjectTaskPatch = z.output<typeof projectTaskPatchSchema>;
export type MoveTaskInput = z.output<typeof moveTaskSchema>;
export type RescheduleTaskInput = z.output<typeof rescheduleTaskSchema>;
export type DependencyInput = z.output<typeof dependencySchema>;
