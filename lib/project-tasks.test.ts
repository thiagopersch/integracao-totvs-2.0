import { describe, expect, it } from "vitest";
import {
  POSITION_STEP,
  buildTaskTree,
  descendantIds,
  insertAfter,
  needsRebalance,
  positionBetween,
  rebalance,
  rollupSummary,
  statusSideEffects,
  wouldCreateCycle,
} from "@/lib/project-tasks";

describe("positionBetween", () => {
  it("bisects between neighbours and steps at the ends", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(2048, null)).toBe(2048 + POSITION_STEP);
    expect(positionBetween(null, 1024)).toBe(0);
    expect(positionBetween()).toBe(POSITION_STEP);
  });

  it("flags exhausted gaps for rebalancing", () => {
    expect(needsRebalance(1, 1 + 1e-9)).toBe(true);
    expect(needsRebalance(1, 2)).toBe(false);
    expect(needsRebalance(null, 2)).toBe(false);
  });

  it("rebalances and inserts by neighbour id", () => {
    expect([...rebalance(["a", "b"]).entries()]).toEqual([["a", 1024], ["b", 2048]]);
    expect(insertAfter(["a", "b", "c"], "x", "a")).toEqual(["a", "x", "b", "c"]);
    expect(insertAfter(["a", "b", "c"], "c", null)).toEqual(["c", "a", "b"]);
    expect(insertAfter(["a", "b"], "a", "b")).toEqual(["b", "a"]);
  });
});

describe("wouldCreateCycle", () => {
  const edges: [string, string][] = [["a", "b"], ["b", "c"]];
  it("detects direct and transitive cycles", () => {
    expect(wouldCreateCycle(edges, ["c", "a"])).toBe(true);
    expect(wouldCreateCycle(edges, ["b", "a"])).toBe(true);
    expect(wouldCreateCycle(edges, ["a", "a"])).toBe(true);
  });
  it("allows acyclic edges", () => {
    expect(wouldCreateCycle(edges, ["a", "c"])).toBe(false);
    expect(wouldCreateCycle(edges, ["d", "a"])).toBe(false);
  });
});

describe("task tree", () => {
  const tasks = [
    { id: "p", parentId: null, priority: "MEDIUM" as const, outlinePosition: 2, number: 1, startDate: null, dueDate: null },
    { id: "c2", priority: "MEDIUM" as const, parentId: "p", outlinePosition: 2, number: 3, startDate: "2026-01-05", dueDate: "2026-01-20" },
    { id: "c1", priority: "MEDIUM" as const, parentId: "p", outlinePosition: 1, number: 2, startDate: "2026-01-01", dueDate: "2026-01-10" },
    { id: "g", priority: "MEDIUM" as const, parentId: "c1", outlinePosition: 1, number: 5, startDate: null, dueDate: "2026-01-25" },
    { id: "r", priority: "MEDIUM" as const, parentId: null, outlinePosition: 1, number: 4, startDate: null, dueDate: null },
  ];

  it("flattens depth-first by outline position", () => {
    expect(buildTaskTree(tasks).map((n) => [n.task.id, n.depth, n.hasChildren])).toEqual([
      ["r", 0, false],
      ["p", 0, true],
      ["c1", 1, true],
      ["g", 2, false],
      ["c2", 1, false],
    ]);
  });

  it("orders siblings by priority (Urgente → Baixa) before outline position", () => {
    const mixed = [
      { id: "low", parentId: null, priority: "LOW" as const, outlinePosition: 1, number: 1 },
      { id: "high", parentId: null, priority: "HIGH" as const, outlinePosition: 3, number: 2 },
      { id: "urgent", parentId: null, priority: "URGENT" as const, outlinePosition: 4, number: 3 },
      { id: "medium", parentId: null, priority: "MEDIUM" as const, outlinePosition: 2, number: 4 },
      { id: "high2", parentId: null, priority: "HIGH" as const, outlinePosition: 2, number: 5 },
    ];
    expect(buildTaskTree(mixed).map((n) => n.task.id)).toEqual(["urgent", "high2", "high", "medium", "low"]);
  });

  it("promotes orphans (filtered parent) to roots", () => {
    expect(buildTaskTree(tasks.filter((t) => t.id !== "p")).map((n) => n.task.id)).toEqual(["c1", "g", "r", "c2"]);
  });

  it("collects descendants and rolls up dates", () => {
    expect([...descendantIds(tasks, "p")].sort()).toEqual(["c1", "c2", "g"]);
    const span = rollupSummary(tasks, "p");
    expect(span.start?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(span.end?.toISOString().slice(0, 10)).toBe("2026-01-25");
  });
});

describe("statusSideEffects", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("stamps and clears completion", () => {
    expect(statusSideEffects("TODO", "DONE", now)).toEqual({ completedAt: now, progress: 100 });
    expect(statusSideEffects("DONE", "IN_PROGRESS", now)).toEqual({ completedAt: null });
    expect(statusSideEffects("TODO", "IN_PROGRESS", now)).toEqual({});
  });
});
