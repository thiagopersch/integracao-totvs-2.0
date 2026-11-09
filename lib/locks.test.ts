import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ redis: null }));

import { withLock } from "./locks";

describe("withLock (in-process fallback)", () => {
  it("skips a second holder while the first runs, then frees the lock", async () => {
    let release!: () => void;
    const first = withLock("t", 10_000, () => new Promise<string>((r) => (release = () => r("first"))));
    const second = await withLock("t", 10_000, async () => "second");
    expect(second).toEqual({ skipped: true });
    release();
    expect(await first).toEqual({ skipped: false, value: "first" });
    expect(await withLock("t", 10_000, async () => "third")).toEqual({ skipped: false, value: "third" });
  });
});
