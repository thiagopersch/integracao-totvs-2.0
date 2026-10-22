import { describe, expect, it } from "vitest";
import { applyListChange, resolveBulkSchedule, toTimeValue } from "./demand-bulk";

describe("applyListChange", () => {
  it("keeps the list without a change", () => {
    expect(applyListChange(["a", "b"], undefined)).toEqual(["a", "b"]);
  });

  it("adds without duplicating", () => {
    expect(applyListChange(["a", "b"], { mode: "add", ids: ["b", "c"] })).toEqual(["a", "b", "c"]);
  });

  it("replaces the whole list", () => {
    expect(applyListChange(["a", "b"], { mode: "replace", ids: ["c", "c"] })).toEqual(["c"]);
  });

  it("removes only the chosen ids", () => {
    expect(applyListChange(["a", "b"], { mode: "remove", ids: ["a", "z"] })).toEqual(["b"]);
    expect(applyListChange(["a"], { mode: "remove", ids: ["a"] })).toEqual([]);
  });
});

describe("resolveBulkSchedule", () => {
  const existing = { startTime: new Date("2026-10-01T08:30:00.000Z"), endTime: new Date("2026-10-01T10:00:00.000Z") };

  it("reads the stored UTC wall-clock time", () => {
    expect(toTimeValue(existing.startTime)).toBe("08:30");
  });

  it("sends nothing when no date/time changes", () => {
    expect(resolveBulkSchedule(existing, {})).toEqual({});
  });

  it("completes the time that didn't change", () => {
    expect(resolveBulkSchedule(existing, { endTime: "12:00" })).toEqual({ startTime: "08:30", endTime: "12:00" });
    expect(resolveBulkSchedule(existing, { startTime: "07:00" })).toEqual({ startTime: "07:00", endTime: "10:00" });
  });

  it("moves both times to the new date", () => {
    expect(resolveBulkSchedule(existing, { date: "2026-10-05" })).toEqual({ date: "2026-10-05", startTime: "08:30", endTime: "10:00" });
  });
});
