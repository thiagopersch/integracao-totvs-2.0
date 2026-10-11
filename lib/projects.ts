/**
 * pt-BR labels/colors for the Gestão de Projetos enums. Client-safe (no Prisma imports) — the enum
 * tuples mirror prisma/schema.prisma and feed both zod schemas and the UI.
 */

export const PROJECT_STATUSES = ["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_HEALTHS = ["GREEN", "YELLOW", "RED"] as const;
export type ProjectHealth = (typeof PROJECT_HEALTHS)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Kanban column order. */
export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const RISK_STATUSES = ["OPEN", "MITIGATING", "OCCURRED", "CLOSED"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em andamento",
  ON_HOLD: "Pausado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  PLANNING: "#8b5cf6",
  IN_PROGRESS: "#3b82f6",
  ON_HOLD: "#f59e0b",
  COMPLETED: "#22c55e",
  CANCELLED: "#6b7280",
};

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  GREEN: "No prazo",
  YELLOW: "Atenção",
  RED: "Crítico",
};

export const PROJECT_HEALTH_COLORS: Record<ProjectHealth, string> = {
  GREEN: "#22c55e",
  YELLOW: "#f59e0b",
  RED: "#ef4444",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: "#22c55e",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  URGENT: "#ef4444",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  IN_REVIEW: "Em revisão",
  BLOCKED: "Bloqueada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  BACKLOG: "#94a3b8",
  TODO: "#8b5cf6",
  IN_PROGRESS: "#3b82f6",
  IN_REVIEW: "#06b6d4",
  BLOCKED: "#ef4444",
  DONE: "#22c55e",
  CANCELLED: "#6b7280",
};

/** Statuses that close a task — excluded from overdue/workload, hidden by default in views. */
export const CLOSED_TASK_STATUSES: readonly TaskStatus[] = ["DONE", "CANCELLED"];

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  OPEN: "Aberto",
  MITIGATING: "Em mitigação",
  OCCURRED: "Ocorreu",
  CLOSED: "Encerrado",
};

export const RISK_STATUS_COLORS: Record<RiskStatus, string> = {
  OPEN: "#f59e0b",
  MITIGATING: "#3b82f6",
  OCCURRED: "#ef4444",
  CLOSED: "#6b7280",
};

/** Probability × impact (1–25) → severity bucket used by the risk matrix. */
export function riskSeverity(probability: number, impact: number): { label: string; color: string } {
  const score = probability * impact;
  if (score >= 15) return { label: "Alto", color: "#ef4444" };
  if (score >= 8) return { label: "Médio", color: "#f59e0b" };
  return { label: "Baixo", color: "#22c55e" };
}

export type ProjectSettings = {
  wipLimits?: Partial<Record<TaskStatus, number>>;
  wipEnforced?: boolean;
  dueSoonDays?: number;
};

export function parseProjectSettings(raw: unknown): ProjectSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const settings: ProjectSettings = {};
  if (value.wipLimits && typeof value.wipLimits === "object") {
    settings.wipLimits = {};
    for (const status of TASK_STATUSES) {
      const limit = (value.wipLimits as Record<string, unknown>)[status];
      if (typeof limit === "number" && limit > 0) settings.wipLimits[status] = limit;
    }
  }
  if (typeof value.wipEnforced === "boolean") settings.wipEnforced = value.wipEnforced;
  if (typeof value.dueSoonDays === "number") settings.dueSoonDays = value.dueSoonDays;
  return settings;
}

/** "PRJ-0001-12" — human task key shown on cards/lists. */
export function taskKey(projectCode: string, number: number): string {
  return `${projectCode}-${number}`;
}

export function formatHours(minutesOrHours: number, unit: "minutes" | "hours" = "hours"): string {
  const hours = unit === "minutes" ? minutesOrHours / 60 : minutesOrHours;
  return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}
