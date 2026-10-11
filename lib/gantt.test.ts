import { describe, expect, it } from "vitest";
import { barGeometry, computeRange, dateToX, dependencyPath, headerCells, pxToDays, utcDay } from "@/lib/gantt";

const d = (s: string) => utcDay(s);

describe("computeRange", () => {
  it("pads task dates and today, aligned to monday on week zoom", () => {
    const { start, end, days } = computeRange(["2026-03-10", null, "2026-03-20"], d("2026-03-12"), "week");
    expect(start.toISOString().slice(0, 10)).toBe("2026-03-02"); // 03-03 minus 7 → monday 02
    expect(days).toBeGreaterThanOrEqual(84);
    expect(end.getTime()).toBeGreaterThan(d("2026-04-03").getTime() - 1);
  });

  it("honours a pinned start and the minimum span", () => {
    const { start, days } = computeRange([], d("2026-03-12"), "day", "2026-01-15");
    expect(start.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(days).toBeGreaterThanOrEqual(31);
  });

  it("starts month zoom on the 1st", () => {
    expect(computeRange([], d("2026-03-12"), "month").start.toISOString().slice(0, 10)).toBe("2026-03-01");
  });
});

describe("geometry", () => {
  it("maps dates to pixels and back", () => {
    expect(dateToX("2026-01-05", d("2026-01-01"), 10)).toBe(40);
    expect(pxToDays(26, 10)).toBe(3);
    expect(pxToDays(-14, 10)).toBe(-1);
  });

  it("builds inclusive bars and single-date bars", () => {
    expect(barGeometry({ startDate: "2026-01-02", dueDate: "2026-01-04" }, d("2026-01-01"), 10)).toMatchObject({ x: 10, width: 30 });
    expect(barGeometry({ startDate: null, dueDate: "2026-01-04" }, d("2026-01-01"), 10)).toMatchObject({ x: 30, width: 10 });
    expect(barGeometry({ startDate: null, dueDate: null }, d("2026-01-01"), 10)).toBeNull();
  });

  it("routes dependency arrows forward or around", () => {
    expect(dependencyPath({ x: 0, width: 50, row: 0 }, { x: 100, row: 2 }, 36)).toBe("M 50 18 H 58 V 90 H 98");
    expect(dependencyPath({ x: 0, width: 50, row: 0 }, { x: 20, row: 1 }, 36)).toBe("M 50 18 H 58 V 36 H 12 V 54 H 18");
  });
});

describe("headerCells", () => {
  it("emits month spans and day cells", () => {
    const { top, bottom } = headerCells(d("2026-01-30"), 4, "day", 10, d("2026-01-31"));
    expect(top.map((c) => [c.label, c.x, c.width])).toEqual([["jan 2026", 0, 20], ["fev 2026", 20, 20]]);
    expect(bottom.map((c) => c.label)).toEqual(["30", "31", "1", "2"]);
    expect(bottom.find((c) => c.today)?.label).toBe("31");
  });
});
