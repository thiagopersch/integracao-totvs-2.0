import { describe, expect, it } from "vitest";
import { classifyDue } from "@/lib/project-deadlines";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("classifyDue", () => {
  const today = d("2026-10-11");

  it("flags overdue with days late", () => {
    expect(classifyDue(d("2026-10-10"), today)).toEqual({ kind: "OVERDUE", daysLate: 1 });
    expect(classifyDue(d("2026-10-01"), today)).toEqual({ kind: "OVERDUE", daysLate: 10 });
  });

  it("flags due soon inside the window, including today", () => {
    expect(classifyDue(d("2026-10-11"), today)).toEqual({ kind: "DUE_SOON", daysLeft: 0 });
    expect(classifyDue(d("2026-10-13"), today)).toEqual({ kind: "DUE_SOON", daysLeft: 2 });
    expect(classifyDue(d("2026-10-14"), today)).toBeNull();
  });

  it("honours a custom window", () => {
    expect(classifyDue(d("2026-10-16"), today, 5)).toEqual({ kind: "DUE_SOON", daysLeft: 5 });
    expect(classifyDue(d("2026-10-12"), today, 0)).toBeNull();
  });
});
