import { describe, expect, it } from "vitest";
import { countActiveFilters, parseWorkspaceParams } from "@/lib/project-workspace-params";

describe("parseWorkspaceParams", () => {
  it("defaults to the kanban with no filters", () => {
    const p = parseWorkspaceParams({});
    expect(p.view).toBe("kanban");
    expect(p.filters).toEqual({
      q: undefined,
      assignee: undefined,
      status: [],
      priority: [],
      tag: undefined,
      due: undefined,
      showCancelled: false,
      customFields: {},
    });
    expect(p.list).toEqual({ page: 1, pageSize: 25, sort: undefined });
    expect(p.gantt).toEqual({ zoom: "week", from: undefined });
    expect(countActiveFilters(p.filters)).toBe(0);
  });

  it("parses filters and per-view params, dropping invalid values", () => {
    const p = parseWorkspaceParams({
      view: "gantt",
      task: "t1",
      q: " login ",
      assignee: "me",
      status: "TODO,NOPE,DONE",
      priority: "HIGH",
      due: "overdue",
      cancelled: "1",
      cf_abc: "o1",
      cf_empty: "",
      sort: "dueDate:desc",
      page: "3",
      pageSize: "1000",
      zoom: "month",
      from: "2026-01-01",
      month: "2026-13-01",
      by: "start",
      swimlane: "assignee",
    });
    expect(p.view).toBe("gantt");
    expect(p.task).toBe("t1");
    expect(p.filters.q).toBe("login");
    expect(p.filters.status).toEqual(["TODO", "DONE"]);
    expect(p.filters.priority).toEqual(["HIGH"]);
    expect(p.filters.due).toBe("overdue");
    expect(p.filters.showCancelled).toBe(true);
    expect(p.filters.customFields).toEqual({ cf_abc: "o1" });
    expect(p.list).toEqual({ page: 3, pageSize: 100, sort: { field: "dueDate", direction: "desc" } });
    expect(p.gantt).toEqual({ zoom: "month", from: "2026-01-01" });
    expect(p.calendar).toEqual({ month: undefined, by: "start" });
    expect(p.kanban.swimlane).toBe("assignee");
    expect(countActiveFilters(p.filters)).toBe(7);
  });

  it("falls back on unknown view and rejects unsafe sort fields", () => {
    const p = parseWorkspaceParams({ view: "hack", sort: "a;drop:asc" });
    expect(p.view).toBe("kanban");
    expect(p.list.sort).toBeUndefined();
  });
});
