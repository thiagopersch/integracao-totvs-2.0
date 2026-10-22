import { describe, expect, it, vi } from "vitest"

// A provider that only settles when the call is aborted — like an SDK honouring its signal.
vi.mock("./anthropic", () => ({
  anthropicToolCall: vi.fn(
    (_config: unknown, _system: string, _messages: unknown, _tool: unknown, signal: AbortSignal) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Request was aborted."))))
  ),
}))

const { runAiToolCall } = await import("./index")

const tool = { name: "t", description: "d", parameters: { type: "object", properties: {} } }

describe("runAiToolCall", () => {
  it("gives up after the configured timeout with a readable message", async () => {
    const config = { provider: "ANTHROPIC" as const, model: "m", apiKey: "k", timeoutSeconds: 0.05 }
    await expect(runAiToolCall(config, "sys", [{ role: "user", content: "oi" }], tool)).rejects.toThrow(
      /não respondeu em 0.05 s/
    )
  })
})
