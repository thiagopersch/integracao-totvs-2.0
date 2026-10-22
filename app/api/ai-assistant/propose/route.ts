import { proposeRecordsWithAi } from "@/actions/ai-assistant"

// A large batch (20+ demands) keeps the model generating for well over a minute. As a Server Action
// the call inherited the timeout of whatever page the bubble was open on (60 s on /demands → 504),
// so it lives in its own route with a limit of its own. Must be a literal (read at build time) —
// keep it 20 s above AI_TIMEOUT_MAX_SECONDS, the cap of the per-organization timeout (AiSettings).
export const maxDuration = 300

// No `dynamic`/`runtime` segment config — incompatible with this project's `cacheComponents`;
// reading the session (auth()) already makes this route request-time.

/** Floating assistant: sends the conversation to the configured AI and returns the proposals. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as { messages?: unknown } | undefined
  try {
    return Response.json(await proposeRecordsWithAi(body?.messages))
  } catch (error) {
    // getRequestContext() throws without a session.
    return Response.json({ success: false, error: (error as Error).message }, { status: 401 })
  }
}
