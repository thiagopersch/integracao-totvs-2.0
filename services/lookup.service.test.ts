import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { decodeCursor, encodeCursor, isLookupEntity } from "./lookup.service";

describe("lookup cursor", () => {
  it("round-trips label and id", () => {
    const cursor = encodeCursor("Ação — Cliente", "abc");
    expect(decodeCursor(cursor)).toEqual(["Ação — Cliente", "abc"]);
  });

  it("ignores malformed cursors", () => {
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(decodeCursor(Buffer.from(JSON.stringify({ a: 1 })).toString("base64url"))).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });

  it("knows the supported entities", () => {
    expect(isLookupEntity("clients")).toBe(true);
    expect(isLookupEntity("users")).toBe(false);
    expect(isLookupEntity("__proto__")).toBe(false);
  });
});
