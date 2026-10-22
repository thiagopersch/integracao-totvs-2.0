import { beforeEach, describe, expect, it, vi } from "vitest"

type Impl = (request: any) => Promise<unknown> // eslint-disable-line @typescript-eslint/no-explicit-any
let impl: Impl = async () => ({})
const calls: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
const generateContent = (request: unknown) => {
  calls.push(request)
  return impl(request)
}

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>()
  return {
    ...actual,
    GoogleGenAI: vi.fn(function () {
      return { models: { generateContent } }
    }),
  }
})

const { geminiToolCall } = await import("./gemini")
const { ApiError } = await import("@google/genai")

const config = { provider: "GEMINI" as const, model: "gemini-2.5-flash", apiKey: "k", timeoutSeconds: 120 }
const tool = { name: "propose_demands", description: "d", parameters: { type: "object", properties: {} } }

describe("geminiToolCall", () => {
  beforeEach(() => {
    calls.length = 0
  })

  it("maps the history roles and returns the function call args", async () => {
    impl = async () => ({
      functionCalls: [{ name: "propose_demands", args: { demands: [] } }],
      candidates: [{ finishReason: "STOP" }],
    })
    const result = await geminiToolCall(
      config,
      "sys",
      [
        { role: "user", content: "oi" },
        { role: "assistant", content: "olá" },
        { role: "user", content: "lança" },
      ],
      tool
    )

    expect(result).toEqual({ toolInput: { demands: [] }, text: "" })
    const request = calls[0]
    expect(request.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"])
    expect(request.config.systemInstruction).toBe("sys")
    expect(request.config.tools[0].functionDeclarations[0].parametersJsonSchema).toBe(tool.parameters)
  })

  it("reports safety blocks and API errors in Portuguese", async () => {
    impl = async () => ({ candidates: [{ finishReason: "SAFETY" }] })
    await expect(geminiToolCall(config, "s", [{ role: "user", content: "x" }], tool)).rejects.toThrow("recusou")

    impl = async () => {
      throw new ApiError({ message: "not found", status: 404 })
    }
    const err = await geminiToolCall(config, "s", [{ role: "user", content: "x" }], tool).catch((e: Error) => e)
    expect((err as Error).message).toContain('Modelo "gemini-2.5-flash" não encontrado')
  })
})
