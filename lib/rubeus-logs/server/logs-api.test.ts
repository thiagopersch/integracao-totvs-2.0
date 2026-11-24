import { describe, expect, it } from "vitest"
import { logFilterBody } from "@/lib/rubeus-logs/server/logs-api"

describe("logFilterBody", () => {
  it("matches the payload the Rubeus admin sends with every filter", () => {
    expect(logFilterBody({ typeIds: [1], portalId: 5757, from: "2026-11-23", to: "2026-11-23", selectiveProcessId: 23430, minDurationMs: 2000 })).toEqual({
      duration: 2000,
      selective_process_id: [23430],
      portal_id: [5757],
      type_id: [1],
      created_at: ["2026-11-23", "2026-11-23"],
    })
  })

  it("leaves out the optional filters (no period = most recent logs)", () => {
    expect(logFilterBody({ typeIds: [0, 1], portalId: 4997, minDurationMs: 0 })).toEqual({ portal_id: [4997], type_id: [0, 1] })
  })
})
