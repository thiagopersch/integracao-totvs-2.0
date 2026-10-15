import { describe, expect, it } from "vitest"
import { readNdjson } from "./field-search-stream"

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

describe("readNdjson", () => {
  it("parses lines split across chunks, multi-line chunks and a last line without newline", async () => {
    const events: unknown[] = []
    await readNdjson(streamOf(['{"a":', '1}\n{"b":2}\n{"c"', ':"ç"}\n\n{"d":4}']), (e) => events.push(e))
    expect(events).toEqual([{ a: 1 }, { b: 2 }, { c: "ç" }, { d: 4 }])
  })

  it("handles a multi-byte character split between chunks", async () => {
    const bytes = new TextEncoder().encode('{"x":"ação"}\n')
    const cut = bytes.indexOf(0xc3) + 1 // inside "ç"
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut))
        controller.enqueue(bytes.slice(cut))
        controller.close()
      },
    })
    const events: unknown[] = []
    await readNdjson(stream, (e) => events.push(e))
    expect(events).toEqual([{ x: "ação" }])
  })
})
