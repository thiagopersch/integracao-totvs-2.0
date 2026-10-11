import { z } from "zod";
import { PRIORITIES, TASK_STATUSES } from "@/lib/projects";
import { optionalDate } from "@/schemas/project.schema";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const projectTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Título é obrigatório").max(300, "Título deve ter no máximo 300 caracteres"),
    description: z.string().max(20000, "Máximo de 20.000 caracteres").optional(),
    status: z.enum(TASK_STATUSES).default("TODO"),
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
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    path: ["dueDate"],
    message: "Prazo deve ser igual ou posterior ao início",
  });

/** Kanban/list inline creation — only a title (and the column it was created in). */
export const quickTaskSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(300),
  status: z.enum(TASK_STATUSES).default("TODO"),
  parentId: z.string().optional(),
  dueDate: optionalDate,
});

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
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

export const timeEntrySchema = z.object({
  taskId: z.string().min(1),
  /** Defaults to the current user; logging for someone else needs projects:update. */
  userId: z.string().optional(),
  date: z.string().regex(DATE_PATTERN, "Data inválida"),
  minutes: z.number().int().min(1, "Informe a duração").max(1440, "Máximo de 24h por apontamento"),
  note: z.string().trim().max(2000).optional(),
});

export type ProjectTaskInput = z.output<typeof projectTaskSchema>;
export type ProjectTaskFormValues = z.input<typeof projectTaskSchema>;
export type QuickTaskInput = z.output<typeof quickTaskSchema>;
export type MoveTaskInput = z.output<typeof moveTaskSchema>;
export type RescheduleTaskInput = z.output<typeof rescheduleTaskSchema>;
export type DependencyInput = z.output<typeof dependencySchema>;
export type TimeEntryInput = z.output<typeof timeEntrySchema>;
