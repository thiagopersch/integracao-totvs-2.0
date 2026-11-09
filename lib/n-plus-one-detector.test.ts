import { beforeEach, describe, expect, it } from "vitest";
import { recordQuery, resetNPlusOneDetector } from "./n-plus-one-detector";

describe("recordQuery", () => {
  beforeEach(() => resetNPlusOneDetector());

  it("warns once when the same statement repeats in a burst", () => {
    const sql = 'SELECT "id" FROM "backups" WHERE "filter_id" = $1 LIMIT $2';
    const warnings = Array.from({ length: 8 }, (_, i) => recordQuery(sql, 1000 + i * 10)).filter(Boolean);
    expect(warnings).toHaveLength(1);
  });

  it("does not warn when executions are spread out", () => {
    const sql = 'SELECT "id" FROM "users" WHERE "id" = $1';
    const warnings = Array.from({ length: 8 }, (_, i) => recordQuery(sql, 1000 + i * 1000)).filter(Boolean);
    expect(warnings).toHaveLength(0);
  });

  it("treats IN lists of different sizes as the same statement", () => {
    for (let i = 0; i < 5; i++) recordQuery(`SELECT 1 FROM "t" WHERE "id" IN ($1,$2${",$3".repeat(i)})`, 1000 + i);
    expect(recordQuery('SELECT 1 FROM "t" WHERE "id" IN ($1)', 1006)).not.toBeNull();
  });
});
