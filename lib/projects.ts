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

/** Display order of tasks in every workspace view: Urgente → Alta → Média → Baixa. */
export const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Comparator: most urgent first. Chain other criteria with `||`. */
export function byPriority(a: { priority: Priority }, b: { priority: Priority }): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

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

/** Workspace views a project can enable (Configurações → Visualizações). */
export const WORKSPACE_VIEWS = ["overview", "kanban", "list", "gantt", "calendar", "dashboard"] as const;
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];

export const WORKSPACE_VIEW_LABELS: Record<WorkspaceView, string> = {
  overview: "Visão geral",
  kanban: "Kanban",
  list: "Lista",
  gantt: "Cronograma",
  calendar: "Calendário",
  dashboard: "Indicadores",
};

export const WORKSPACE_VIEW_DESCRIPTIONS: Record<WorkspaceView, string> = {
  overview: "Termo de abertura, equipe, fases, marcos, riscos e propriedades.",
  kanban: "Quadro por etapas do fluxo, com arrastar e soltar e limite WIP.",
  list: "Tabela com hierarquia de tarefas, ordenação e ações em massa.",
  gantt: "Cronograma por fases com barras arrastáveis e dependências.",
  calendar: "Prazos (ou inícios) das tarefas num calendário mensal.",
  dashboard: "Progresso x planejado, burndown, carga da equipe, horas e custo.",
};

export type ProjectSettings = {
  wipEnforced?: boolean;
  dueSoonDays?: number;
  enabledViews: WorkspaceView[];
  defaultView: WorkspaceView;
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = { enabledViews: [...WORKSPACE_VIEWS], defaultView: "kanban" };

export function parseProjectSettings(raw: unknown): ProjectSettings {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const enabledViews = Array.isArray(value.enabledViews)
    ? WORKSPACE_VIEWS.filter((v) => (value.enabledViews as unknown[]).includes(v))
    : [...WORKSPACE_VIEWS];
  const views = enabledViews.length ? enabledViews : [...WORKSPACE_VIEWS];
  const defaultView = views.includes(value.defaultView as WorkspaceView) ? (value.defaultView as WorkspaceView) : views.includes("kanban") ? "kanban" : views[0];
  const settings: ProjectSettings = { enabledViews: views, defaultView };
  if (typeof value.wipEnforced === "boolean") settings.wipEnforced = value.wipEnforced;
  if (typeof value.dueSoonDays === "number") settings.dueSoonDays = value.dueSoonDays;
  return settings;
}

/** How a workflow stage counts for metrics (ProjectStage.category ↔ ProjectTask.status). */
export const STAGE_CATEGORY_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Não iniciada (backlog)",
  TODO: "Não iniciada (a fazer)",
  IN_PROGRESS: "Em andamento",
  IN_REVIEW: "Em revisão",
  BLOCKED: "Bloqueada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export type StageInput = { id?: string; name: string; color: string; category: TaskStatus; wipLimit: number | null };
export type PhaseInput = { id?: string; name: string; color: string; description?: string; startDate?: string; endDate?: string };

/** Workflow created for new projects (and backfilled for existing ones). */
export const DEFAULT_STAGES: StageInput[] = [
  { name: "Backlog", color: "#94a3b8", category: "BACKLOG", wipLimit: null },
  { name: "A fazer", color: "#8b5cf6", category: "TODO", wipLimit: null },
  { name: "Em andamento", color: "#3b82f6", category: "IN_PROGRESS", wipLimit: null },
  { name: "Em revisão", color: "#06b6d4", category: "IN_REVIEW", wipLimit: null },
  { name: "Bloqueada", color: "#ef4444", category: "BLOCKED", wipLimit: null },
  { name: "Concluída", color: "#22c55e", category: "DONE", wipLimit: null },
  { name: "Cancelada", color: "#6b7280", category: "CANCELLED", wipLimit: null },
];

/** Suggested macro phases (PMBOK process groups) — offered as a one-click start in the settings. */
export const SUGGESTED_PHASES: PhaseInput[] = [
  { name: "Iniciação", color: "#8b5cf6" },
  { name: "Planejamento", color: "#3b82f6" },
  { name: "Execução", color: "#f59e0b" },
  { name: "Monitoramento e controle", color: "#06b6d4" },
  { name: "Encerramento", color: "#22c55e" },
];

/** Risk probability/impact scale 1–5, green → red. */
export const RISK_SCALE_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#84cc16", 3: "#f59e0b", 4: "#f97316", 5: "#ef4444" };
export const RISK_SCALE_LABELS: Record<number, string> = { 1: "Muito baixo", 2: "Baixo", 3: "Médio", 4: "Alto", 5: "Muito alto" };

export type StageRef = { id: string; name: string; color: string; category: TaskStatus; wipLimit: number | null };
export type PhaseRef = { id: string; name: string; color: string; startDate: Date | string | null; endDate: Date | string | null; description: string | null };

/** "PRJ-0001-12" — human task key shown on cards/lists. */
export function taskKey(projectCode: string, number: number): string {
  return `${projectCode}-${number}`;
}

export function formatHours(minutesOrHours: number, unit: "minutes" | "hours" = "hours"): string {
  const hours = unit === "minutes" ? minutesOrHours / 60 : minutesOrHours;
  return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}
