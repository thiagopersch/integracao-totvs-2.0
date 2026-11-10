import { proposeRecordsWithAi } from "@/actions/ai-assistant"

// A large batch (20+ demands) keeps the model generating for well over a minute. As a Server Action
// the call inherited the timeout of whatever page the bubble was open on (60 s on /demands → 504),
// so it lives in its own route with a limit of its own. Must be a literal (read at build time) —
// keep it 20 s above AI_TIMEOUT_MAX_SECONDS, the cap of the per-organization timeout (AiSettings).
export const maxDuration = 300

// No `dynamic`/`runtime` segment config — incompatible with this project's `cacheComponents`;
// reading the session (auth()) already makes this route request-time.

/**
 * Floating assistant: sends the conversation to the configured AI and streams the answer as
 * NDJSON — `{"type":"delta","chunk":"…"}` for each fragment of the tool-call JSON the model writes
 * (the client renders the reply and the records as they arrive), then one `{"type":"done",…}` with
 * the validated result.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as { messages?: unknown } | undefined
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        } catch {
          // Client went away; the model call finishes on its own.
        }
      }
      try {
        const result = await proposeRecordsWithAi(body?.messages, (chunk) => write({ type: "delta", chunk }))
        write({ type: "done", result })
      } catch (error) {
        // getRequestContext() throws without a session.
        write({ type: "done", result: { success: false, error: (error as Error).message } })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      // no-transform: proxies/CDN must not buffer or compress the stream.
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
