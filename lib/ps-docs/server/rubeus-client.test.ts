import { describe, expect, it } from "vitest"
import { createLimiter } from "./rubeus-client"

describe("createLimiter", () => {
  it("never runs more than the limit at once and runs everything", async () => {
    const run = createLimiter(3)
    let active = 0
    let peak = 0
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        run(async () => {
          active++
          peak = Math.max(peak, active)
          await new Promise((r) => setTimeout(r, 1 + (i % 4)))
          active--
          return i
        })
      )
    )
    expect(peak).toBe(3)
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i))
  })

  it("frees the slot when a task throws", async () => {
    const run = createLimiter(1)
    await expect(run(async () => Promise.reject(new Error("x")))).rejects.toThrow("x")
    await expect(run(async () => "ok")).resolves.toBe("ok")
  })
})
