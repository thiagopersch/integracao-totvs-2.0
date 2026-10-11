import { PRIORITIES, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/projects";
import { CUSTOM_FIELD_PARAM_PREFIX } from "@/lib/custom-fields";

/**
 * URL contract of the project workspace (/projetos/gestao/[id]): `view` picks the tab, task
 * filters are shared by every view, and each view has its own params. Pure + client-safe.
 */

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

export type DueFilter = "overdue" | "week" | "none";
export type Swimlane = "none" | "assignee" | "priority";
export type GanttZoom = "day" | "week" | "month";

export type TaskFilters = {
  q?: string;
  /** user id, "me" or "none" */
  assignee?: string;
  status: TaskStatus[];
  priority: Priority[];
  tag?: string;
  due?: DueFilter;
  /** Cancelled tasks are hidden unless asked for (or filtered by status). */
  showCancelled: boolean;
  /** `cf_<defId>` → value */
  customFields: Record<string, string>;
};

export type WorkspaceParams = {
  view: WorkspaceView;
  task?: string;
  filters: TaskFilters;
  list: { page: number; pageSize: number; sort?: { field: string; direction: "asc" | "desc" } };
  kanban: { swimlane: Swimlane };
  gantt: { zoom: GanttZoom; from?: string };
  calendar: { month?: string; by: "due" | "start" };
};

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | undefined {
  const value = params[key];
  const str = Array.isArray(value) ? value[0] : value;
  return str?.trim() ? str.trim() : undefined;
}

function csv<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return [];
  return value.split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseWorkspaceParams(params: RawParams): WorkspaceParams {
  const customFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(CUSTOM_FIELD_PARAM_PREFIX)) continue;
    const v = one({ [key]: value }, key);
    if (v) customFields[key] = v;
  }
  const sort = one(params, "sort");
  const [sortField, sortDir] = sort?.split(":") ?? [];
  const month = one(params, "month");
  const from = one(params, "from");

  return {
    view: pick(one(params, "view"), WORKSPACE_VIEWS, "kanban"),
    task: one(params, "task"),
    filters: {
      q: one(params, "q"),
      assignee: one(params, "assignee"),
      status: csv(one(params, "status"), TASK_STATUSES),
      priority: csv(one(params, "priority"), PRIORITIES),
      tag: one(params, "tag"),
      due: pick<DueFilter | "">(one(params, "due"), ["overdue", "week", "none"], "") || undefined,
      showCancelled: one(params, "cancelled") === "1",
      customFields,
    },
    list: {
      page: Math.max(1, Number(one(params, "page")) || 1),
      pageSize: Math.min(100, Math.max(5, Number(one(params, "pageSize")) || 25)),
      sort: sortField && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(sortField) ? { field: sortField, direction: sortDir === "desc" ? "desc" : "asc" } : undefined,
    },
    kanban: { swimlane: pick(one(params, "swimlane"), ["none", "assignee", "priority"] as const, "none") },
    gantt: {
      zoom: pick(one(params, "zoom"), ["day", "week", "month"] as const, "week"),
      from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
    },
    calendar: {
      month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
      by: one(params, "by") === "start" ? "start" : "due",
    },
  };
}

/** Number of active task filters (badge on the filter button). */
export function countActiveFilters(filters: TaskFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.assignee ? 1 : 0) +
    (filters.status.length ? 1 : 0) +
    (filters.priority.length ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.due ? 1 : 0) +
    (filters.showCancelled ? 1 : 0) +
    Object.keys(filters.customFields).length
  );
}

/** URL param keys owned by the task filters (cleared by "Limpar filtros"). */
export function filterParamKeys(customFieldKeys: string[]): string[] {
  return ["q", "assignee", "status", "priority", "tag", "due", "cancelled", ...customFieldKeys];
}
