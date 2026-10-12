import { PRIORITIES, WORKSPACE_VIEWS, type Priority, type WorkspaceView } from "@/lib/projects";
import { CUSTOM_FIELD_PARAM_PREFIX } from "@/lib/custom-fields";

/**
 * URL contract of the project workspace (/projetos/gestao/[id]): `view` picks the tab, task
 * filters are shared by every view, and each view has its own params. Pure + client-safe.
 */

export { WORKSPACE_VIEWS, WORKSPACE_VIEW_LABELS, type WorkspaceView } from "@/lib/projects";

export type DueFilter = "overdue" | "week" | "none";
export type Swimlane = "none" | "assignee" | "priority";
export type GanttZoom = "day" | "week" | "month";

export type TaskFilters = {
  q?: string;
  /** user id, "me" or "none" */
  assignee?: string;
  /** ProjectStage ids */
  stage: string[];
  /** ProjectPhase id or "none" */
  phase?: string;
  priority: Priority[];
  tag?: string;
  due?: DueFilter;
  /** Cancelled tasks are hidden unless asked for (or filtered by stage). */
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

const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

function ids(value: string | undefined): string[] {
  return value ? value.split(",").filter((v) => ID_PATTERN.test(v)) : [];
}

/** `defaults` come from the project settings: the view used when the URL has none (or a disabled one). */
export function parseWorkspaceParams(
  params: RawParams,
  defaults: { enabledViews?: readonly WorkspaceView[]; defaultView?: WorkspaceView } = {},
): WorkspaceParams {
  const enabled = defaults.enabledViews?.length ? defaults.enabledViews : WORKSPACE_VIEWS;
  const fallbackView =
    defaults.defaultView && enabled.includes(defaults.defaultView) ? defaults.defaultView : enabled.includes("kanban") ? "kanban" : enabled[0];
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
    view: pick(one(params, "view"), enabled, fallbackView),
    task: one(params, "task"),
    filters: {
      q: one(params, "q"),
      assignee: one(params, "assignee"),
      stage: ids(one(params, "stage")),
      phase: ((p) => (p && ID_PATTERN.test(p) ? p : undefined))(one(params, "phase")),
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
    (filters.stage.length ? 1 : 0) +
    (filters.phase ? 1 : 0) +
    (filters.priority.length ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.due ? 1 : 0) +
    (filters.showCancelled ? 1 : 0) +
    Object.keys(filters.customFields).length
  );
}

/** URL param keys owned by the task filters (cleared by "Limpar filtros"). */
export function filterParamKeys(customFieldKeys: string[]): string[] {
  return ["q", "assignee", "stage", "phase", "priority", "tag", "due", "cancelled", ...customFieldKeys];
}
