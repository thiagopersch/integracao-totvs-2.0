import { describe, expect, it } from "vitest";
import {
  buildBurnSeries,
  buildWorkload,
  computeHealth,
  computeProjectProgress,
  expectedProgress,
  type HealthInput,
  type MetricTask,
} from "@/lib/project-metrics";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

function task(partial: Partial<MetricTask> & { id: string }): MetricTask {
  return { parentId: null, status: "TODO", progress: 0, estimateHours: null, isMilestone: false, ...partial };
}

describe("computeProjectProgress", () => {
  it("averages leaf tasks equally without estimates", () => {
    expect(computeProjectProgress([task({ id: "a", status: "DONE" }), task({ id: "b", progress: 50 }), task({ id: "c" })])).toBe(50);
  });

  it("weights by estimate, ignores parents, milestones and cancelled", () => {
    const tasks = [
      task({ id: "p" }), // parent: ignored
      task({ id: "a", parentId: "p", status: "DONE", estimateHours: 30 }),
      task({ id: "b", parentId: "p", estimateHours: 10 }),
      task({ id: "m", isMilestone: true, status: "DONE" }),
      task({ id: "x", status: "CANCELLED", estimateHours: 100 }),
    ];
    expect(computeProjectProgress(tasks)).toBe(75);
  });

  it("gives unestimated tasks the average estimate", () => {
    // a: 10h done, b: 30h, c: no estimate → 20h → 10/(10+30+20)
    const tasks = [task({ id: "a", status: "DONE", estimateHours: 10 }), task({ id: "b", estimateHours: 30 }), task({ id: "c" })];
    expect(computeProjectProgress(tasks)).toBe(16.7);
  });

  it("is 0 without tasks", () => {
    expect(computeProjectProgress([])).toBe(0);
  });
});

describe("computeHealth", () => {
  const base: HealthInput = {
    manual: null,
    status: "IN_PROGRESS",
    plannedStartDate: d("2026-01-01"),
    plannedEndDate: d("2026-01-31"),
    progress: 50,
    openCount: 10,
    overdueCount: 0,
    blockedCount: 0,
    loggedHours: 0,
    budgetHours: null,
    today: d("2026-01-16"),
  };

  it("is green when on track", () => {
    expect(computeHealth(base)).toEqual({ health: "GREEN", auto: true, reasons: [] });
  });

  it("flags schedule slippage", () => {
    expect(computeHealth({ ...base, progress: 35 }).health).toBe("YELLOW");
    expect(computeHealth({ ...base, progress: 10 }).health).toBe("RED");
  });

  it("flags overdue, blocked and past deadline", () => {
    expect(computeHealth({ ...base, overdueCount: 1 }).health).toBe("YELLOW");
    expect(computeHealth({ ...base, overdueCount: 3 }).health).toBe("RED");
    expect(computeHealth({ ...base, blockedCount: 2 }).reasons).toContain("2 tarefa(s) bloqueada(s)");
    expect(computeHealth({ ...base, today: d("2026-02-02"), progress: 100 }).health).toBe("RED");
  });

  it("flags hours over budget", () => {
    expect(computeHealth({ ...base, budgetHours: 100, loggedHours: 120 }).health).toBe("RED");
    expect(computeHealth({ ...base, budgetHours: 100, loggedHours: 95 }).health).toBe("YELLOW");
  });

  it("lets manual health win but keeps reasons", () => {
    const result = computeHealth({ ...base, manual: "GREEN", overdueCount: 5 });
    expect(result.health).toBe("GREEN");
    expect(result.auto).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("completed projects are green", () => {
    expect(computeHealth({ ...base, status: "COMPLETED", overdueCount: 9 }).health).toBe("GREEN");
  });
});

describe("expectedProgress", () => {
  it("clamps to 0–100", () => {
    expect(expectedProgress(d("2026-01-01"), d("2026-01-11"), d("2025-12-01"))).toBe(0);
    expect(expectedProgress(d("2026-01-01"), d("2026-01-11"), d("2026-01-06"))).toBe(50);
    expect(expectedProgress(d("2026-01-01"), d("2026-01-11"), d("2026-03-01"))).toBe(100);
    expect(expectedProgress(null, d("2026-01-11"), d("2026-01-06"))).toBeNull();
  });
});

describe("buildBurnSeries", () => {
  it("tracks remaining/completed scope up to today and an ideal line", () => {
    const tasks = [
      task({ id: "a", status: "DONE", createdAt: d("2026-01-01"), completedAt: d("2026-01-02") }),
      task({ id: "b", createdAt: d("2026-01-01") }),
      task({ id: "c", createdAt: d("2026-01-03") }),
    ];
    const { unit, points } = buildBurnSeries(tasks, d("2026-01-01"), d("2026-01-05"), d("2026-01-03"));
    expect(unit).toBe("tasks");
    expect(points.map((p) => p.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]);
    expect(points.map((p) => p.remaining)).toEqual([2, 1, 2, null, null]);
    expect(points.map((p) => p.completed)).toEqual([0, 1, 1, null, null]);
    expect(points[0].ideal).toBe(3);
    expect(points[4].ideal).toBe(0);
  });

  it("samples long ranges to at most ~60 points", () => {
    const { points } = buildBurnSeries([task({ id: "a", createdAt: d("2026-01-01") })], d("2026-01-01"), d("2026-12-31"), d("2026-06-01"));
    expect(points.length).toBeLessThanOrEqual(62);
    expect(points.at(-1)!.date).toBe("2026-12-31");
  });
});

describe("buildWorkload", () => {
  it("groups open work and logged hours per assignee", () => {
    const rows = buildWorkload(
      [
        task({ id: "a", assigneeId: "u1", estimateHours: 4, dueDate: d("2026-01-01"), loggedMinutes: 90 }),
        task({ id: "b", assigneeId: "u1", status: "DONE", loggedMinutes: 30 }),
        task({ id: "c", assigneeId: null, estimateHours: 2 }),
      ],
      d("2026-01-10"),
    );
    expect(rows).toEqual([
      { assigneeId: "u1", open: 1, overdue: 1, openEstimateHours: 4, loggedHours: 2 },
      { assigneeId: null, open: 1, overdue: 0, openEstimateHours: 2, loggedHours: 0 },
    ]);
  });
});
