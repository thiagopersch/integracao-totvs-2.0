import { CLOSED_TASK_STATUSES, type ProjectHealth, type ProjectStatus, type TaskStatus } from "@/lib/projects";

/**
 * Pure project metrics (progress, health, burndown, workload) — shared by services (denormalized
 * `Project.progress`, list health) and the dashboard. Dates are date-only values at UTC midnight
 * (same convention as `Demand.date`); `today` is passed in so callers/tests control the clock.
 */

const DAY_MS = 86_400_000;

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type MetricTask = {
  id: string;
  parentId: string | null;
  status: TaskStatus;
  progress: number;
  estimateHours: number | null;
  isMilestone: boolean;
  dueDate?: DateLike;
  createdAt?: DateLike;
  completedAt?: DateLike;
  assigneeId?: string | null;
  loggedMinutes?: number;
};

export function isClosedStatus(status: TaskStatus): boolean {
  return CLOSED_TASK_STATUSES.includes(status);
}

/** 0–100, or null when the task doesn't count (cancelled). */
export function effectiveTaskProgress(task: Pick<MetricTask, "status" | "progress">): number | null {
  if (task.status === "CANCELLED") return null;
  if (task.status === "DONE") return 100;
  return Math.max(0, Math.min(100, task.progress || 0));
}

export function isOverdue(task: Pick<MetricTask, "status" | "dueDate">, today: Date): boolean {
  const due = toDate(task.dueDate);
  return !!due && !isClosedStatus(task.status) && due.getTime() < today.getTime();
}

/** Leaf tasks (no live children) excluding cancelled and milestones — the units of work measured. */
function workItems(tasks: MetricTask[]): MetricTask[] {
  const parents = new Set(tasks.map((t) => t.parentId).filter((id): id is string => !!id));
  return tasks.filter((t) => !parents.has(t.id) && !t.isMilestone && t.status !== "CANCELLED");
}

/**
 * Weight per work item: its estimate when the project uses estimates (tasks without one get the
 * average estimate), otherwise 1 each.
 */
function weights(items: MetricTask[]): Map<string, number> {
  const estimated = items.filter((t) => (t.estimateHours ?? 0) > 0);
  const average = estimated.length ? estimated.reduce((s, t) => s + (t.estimateHours ?? 0), 0) / estimated.length : 1;
  return new Map(items.map((t) => [t.id, estimated.length ? ((t.estimateHours ?? 0) > 0 ? t.estimateHours! : average) : 1]));
}

/** Weighted % complete of the project (0–100, one decimal). */
export function computeProjectProgress(tasks: MetricTask[]): number {
  const items = workItems(tasks);
  if (items.length === 0) return 0;
  const w = weights(items);
  let total = 0;
  let done = 0;
  for (const task of items) {
    const weight = w.get(task.id)!;
    total += weight;
    done += (weight * (effectiveTaskProgress(task) ?? 0)) / 100;
  }
  return Math.round((done / total) * 1000) / 10;
}

export type HealthInput = {
  manual: ProjectHealth | null;
  status: ProjectStatus;
  plannedStartDate: DateLike;
  plannedEndDate: DateLike;
  progress: number;
  openCount: number;
  overdueCount: number;
  blockedCount: number;
  loggedHours: number;
  budgetHours: number | null;
  today: Date;
};

export type HealthResult = { health: ProjectHealth | null; auto: boolean; reasons: string[] };

const SEVERITY: Record<ProjectHealth, number> = { GREEN: 0, YELLOW: 1, RED: 2 };

/** % of the planned schedule elapsed at `today` (0–100), or null without both planned dates. */
export function expectedProgress(plannedStart: DateLike, plannedEnd: DateLike, today: Date): number | null {
  const start = toDate(plannedStart);
  const end = toDate(plannedEnd);
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  const ratio = (today.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

/**
 * RAG health from schedule (planned vs actual %), deadline, overdue/blocked tasks and hours vs
 * budget. A manually set health wins, but the computed reasons are still returned for context.
 */
export function computeHealth(input: HealthInput): HealthResult {
  if (input.status === "CANCELLED") return { health: input.manual, auto: !input.manual, reasons: [] };
  if (input.status === "COMPLETED") return { health: input.manual ?? "GREEN", auto: !input.manual, reasons: [] };

  let level: ProjectHealth = "GREEN";
  const reasons: string[] = [];
  const flag = (next: ProjectHealth, reason: string) => {
    if (SEVERITY[next] > SEVERITY[level]) level = next;
    reasons.push(reason);
  };

  const end = toDate(input.plannedEndDate);
  if (end && end.getTime() < input.today.getTime()) {
    flag("RED", "Prazo final do projeto vencido");
  }

  const expected = expectedProgress(input.plannedStartDate, input.plannedEndDate, input.today);
  if (expected !== null) {
    const gap = expected - input.progress;
    if (gap > 25) flag("RED", `Progresso ${Math.round(gap)} p.p. abaixo do planejado (${Math.round(input.progress)}% de ${expected}%)`);
    else if (gap > 10) flag("YELLOW", `Progresso ${Math.round(gap)} p.p. abaixo do planejado (${Math.round(input.progress)}% de ${expected}%)`);
  }

  if (input.overdueCount > 0) {
    const share = input.openCount ? input.overdueCount / input.openCount : 0;
    flag(input.overdueCount >= 3 || share >= 0.2 ? "RED" : "YELLOW", `${input.overdueCount} tarefa(s) atrasada(s)`);
  }

  if (input.blockedCount > 0) flag("YELLOW", `${input.blockedCount} tarefa(s) bloqueada(s)`);

  if (input.budgetHours && input.budgetHours > 0) {
    const used = input.loggedHours / input.budgetHours;
    if (used > 1.1) flag("RED", `Horas apontadas em ${Math.round(used * 100)}% do orçamento`);
    else if (used >= 0.9 && input.progress < 90) flag("YELLOW", `Horas apontadas em ${Math.round(used * 100)}% do orçamento com ${Math.round(input.progress)}% concluído`);
  }

  return { health: input.manual ?? level, auto: !input.manual, reasons };
}

export type BurnPoint = {
  date: string;
  /** Remaining scope (null after today). */
  remaining: number | null;
  /** Completed scope (null after today). */
  completed: number | null;
  scope: number | null;
  ideal: number;
};

/**
 * Burndown/burnup series. Unit is estimate hours when the project uses estimates, otherwise task
 * count. Range: planned start (or first task) → planned end (or today), sampled to ≤ 60 points.
 */
export function buildBurnSeries(
  tasks: MetricTask[],
  plannedStart: DateLike,
  plannedEnd: DateLike,
  today: Date,
): { unit: "hours" | "tasks"; points: BurnPoint[] } {
  const items = workItems(tasks);
  const w = weights(items);
  const unit = items.some((t) => (t.estimateHours ?? 0) > 0) ? "hours" : "tasks";
  if (items.length === 0) return { unit, points: [] };

  const created = items.map((t) => toDate(t.createdAt) ?? today);
  const start = startOfUtcDay(toDate(plannedStart) ?? new Date(Math.min(...created.map((d) => d.getTime()))));
  let end = startOfUtcDay(toDate(plannedEnd) ?? today);
  if (end.getTime() < start.getTime()) end = start;

  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const step = Math.max(1, Math.ceil(days / 60));
  const totalScope = items.reduce((s, t) => s + w.get(t.id)!, 0);

  const points: BurnPoint[] = [];
  for (let offset = 0; ; offset += step) {
    const isLast = offset >= days;
    const day = new Date(start.getTime() + Math.min(offset, days) * DAY_MS);
    const dayEnd = day.getTime() + DAY_MS;
    const future = day.getTime() > today.getTime();
    let scope = 0;
    let completed = 0;
    items.forEach((t, i) => {
      if (created[i].getTime() >= dayEnd) return;
      const weight = w.get(t.id)!;
      scope += weight;
      const completedAt = toDate(t.completedAt);
      if (t.status === "DONE" && completedAt && completedAt.getTime() < dayEnd) completed += weight;
    });
    const ideal = days === 0 ? 0 : totalScope * (1 - Math.min(offset, days) / days);
    points.push({
      date: toDateKey(day),
      remaining: future ? null : round1(scope - completed),
      completed: future ? null : round1(completed),
      scope: future ? null : round1(scope),
      ideal: round1(ideal),
    });
    if (isLast) break;
  }
  return { unit, points };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type WorkloadRow = {
  assigneeId: string | null;
  open: number;
  overdue: number;
  openEstimateHours: number;
  loggedHours: number;
};

/** Open work and logged hours per assignee (null = unassigned). Leaf tasks only. */
export function buildWorkload(tasks: MetricTask[], today: Date): WorkloadRow[] {
  const parents = new Set(tasks.map((t) => t.parentId).filter((id): id is string => !!id));
  const rows = new Map<string | null, WorkloadRow>();
  for (const task of tasks) {
    if (parents.has(task.id)) continue;
    const key = task.assigneeId ?? null;
    const row = rows.get(key) ?? { assigneeId: key, open: 0, overdue: 0, openEstimateHours: 0, loggedHours: 0 };
    row.loggedHours += (task.loggedMinutes ?? 0) / 60;
    if (!isClosedStatus(task.status)) {
      row.open += 1;
      row.openEstimateHours += task.estimateHours ?? 0;
      if (isOverdue(task, today)) row.overdue += 1;
    }
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, loggedHours: round1(r.loggedHours), openEstimateHours: round1(r.openEstimateHours) }))
    .sort((a, b) => b.open - a.open || b.loggedHours - a.loggedHours);
}

export function countByStatus(tasks: Pick<MetricTask, "status">[]): Record<TaskStatus, number> {
  const counts = { BACKLOG: 0, TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, BLOCKED: 0, DONE: 0, CANCELLED: 0 } as Record<TaskStatus, number>;
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}
