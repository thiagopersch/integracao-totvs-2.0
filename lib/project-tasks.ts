import { byPriority, type Priority, type TaskStatus } from "@/lib/projects";

/**
 * Pure helpers for project tasks: fractional ordering (kanban columns / WBS siblings), dependency
 * cycle detection, WBS tree flattening and parent roll-ups. Client-safe.
 */

export const POSITION_STEP = 1024;
const MIN_GAP = 1e-6;

/**
 * Position for an item dropped between two neighbours (either may be missing: top/bottom of the
 * list or an empty list). Neighbours are looked up by id on the server, so concurrent/filtered
 * views can't corrupt the order the way indices would.
 */
export function positionBetween(before?: number | null, after?: number | null): number {
  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + POSITION_STEP;
  if (hasAfter) return after - POSITION_STEP;
  return POSITION_STEP;
}

/** True when the gap between neighbours is too small to keep bisecting (float precision). */
export function needsRebalance(before?: number | null, after?: number | null): boolean {
  if (before === null || before === undefined || after === null || after === undefined) return false;
  return Math.abs(after - before) < MIN_GAP;
}

/** Evenly spaced positions for an ordered id list. */
export function rebalance(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, (i + 1) * POSITION_STEP]));
}

/**
 * Inserts `id` into an ordered list right after `beforeId` (or at the top when null/absent) —
 * used when a column must be rebalanced to place the moved card.
 */
export function insertAfter(orderedIds: string[], id: string, beforeId: string | null | undefined): string[] {
  const rest = orderedIds.filter((x) => x !== id);
  const index = beforeId ? rest.indexOf(beforeId) + 1 : 0;
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

/**
 * Neighbours of a dropped card among the cards of the same priority. Boards sort by priority before
 * the manual position, so positions aren't monotonic across priority groups and only same-rank
 * neighbours describe where the card was dropped.
 */
export function sameRankNeighbours(
  orderedIds: string[],
  movedId: string,
  priorityOf: (id: string) => Priority | undefined,
): { beforeId: string | null; afterId: string | null } {
  const rank = priorityOf(movedId);
  const peers = orderedIds.filter((id) => id === movedId || priorityOf(id) === rank);
  const index = peers.indexOf(movedId);
  if (index < 0) return { beforeId: null, afterId: null };
  return { beforeId: peers[index - 1] ?? null, afterId: peers[index + 1] ?? null };
}

/**
 * Would adding `predecessor → successor` close a cycle? True when `predecessor` is already
 * reachable from `successor` through the existing edges (or both are the same task).
 */
export function wouldCreateCycle(edges: [predecessor: string, successor: string][], newEdge: [string, string]): boolean {
  const [from, to] = newEdge;
  if (from === to) return true;
  const next = new Map<string, string[]>();
  for (const [p, s] of edges) next.set(p, [...(next.get(p) ?? []), s]);
  const stack = [to];
  const seen = new Set<string>();
  while (stack.length) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(next.get(node) ?? []));
  }
  return false;
}

/** Ids of every descendant of `id` in a parent/child forest — a task can't be re-parented under one. */
export function descendantIds(tasks: { id: string; parentId: string | null }[], id: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const t of tasks) if (t.parentId) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t.id]);
  const result = new Set<string>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (result.has(node)) continue;
    result.add(node);
    stack.push(...(children.get(node) ?? []));
  }
  return result;
}

export type TreeNode<T> = { task: T; depth: number; hasChildren: boolean };

/**
 * Depth-first WBS order (siblings by priority — most urgent first — then outlinePosition, number). Tasks whose parent isn't in the
 * list (filtered out) become roots, so a filtered view never loses rows.
 */
export function buildTaskTree<T extends { id: string; parentId: string | null; priority: Priority; outlinePosition: number; number: number }>(
  tasks: T[],
): TreeNode<T>[] {
  const ids = new Set(tasks.map((t) => t.id));
  const byParent = new Map<string | null, T[]>();
  for (const task of tasks) {
    const key = task.parentId && ids.has(task.parentId) ? task.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), task]);
  }
  const order = (a: T, b: T) => byPriority(a, b) || a.outlinePosition - b.outlinePosition || a.number - b.number;
  const result: TreeNode<T>[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const task of (byParent.get(parentId) ?? []).sort(order)) {
      const children = byParent.get(task.id) ?? [];
      result.push({ task, depth, hasChildren: children.length > 0 });
      visit(task.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

type DatedTask = { id: string; parentId: string | null; startDate: Date | string | null; dueDate: Date | string | null };

/** Summary span of a parent from all its descendants (gantt brackets). */
export function rollupSummary(tasks: DatedTask[], parentId: string): { start: Date | null; end: Date | null } {
  const descendants = descendantIds(tasks, parentId);
  let start: number | null = null;
  let end: number | null = null;
  for (const task of tasks) {
    if (!descendants.has(task.id)) continue;
    const s = task.startDate ? new Date(task.startDate).getTime() : null;
    const e = task.dueDate ? new Date(task.dueDate).getTime() : null;
    for (const v of [s, e]) {
      if (v === null) continue;
      start = start === null ? v : Math.min(start, v);
      end = end === null ? v : Math.max(end, v);
    }
  }
  return { start: start === null ? null : new Date(start), end: end === null ? null : new Date(end) };
}

/** Status-driven fields: completing stamps completedAt + 100%, reopening clears completedAt. */
export function statusSideEffects(
  prev: TaskStatus | null,
  next: TaskStatus,
  now: Date,
): { completedAt?: Date | null; progress?: number } {
  if (next === "DONE" && prev !== "DONE") return { completedAt: now, progress: 100 };
  if (prev === "DONE" && next !== "DONE") return { completedAt: null };
  return {};
}

/**
 * Default assignee of a new task: the project's only possible assignee (manager ∪ active members,
 * deduplicated — the manager is normally a member too), or null when there are zero or several.
 */
export function soleAssigneeId(managerId: string | null, memberUserIds: string[]): string | null {
  const people = new Set([...memberUserIds, ...(managerId ? [managerId] : [])]);
  return people.size === 1 ? [...people][0] : null;
}
