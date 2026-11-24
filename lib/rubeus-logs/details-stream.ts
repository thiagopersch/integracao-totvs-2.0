import type { RubeusLogDetail } from "@/lib/rubeus-logs/types"

/** One NDJSON line of `POST /api/rubeus-logs/details`. */
export type LogDetailsEvent =
  | { type: "detail"; log: RubeusLogDetail }
  | { type: "failed"; id: number; error: string }
  | { type: "error"; error: string }
  | { type: "done"; loaded: number; failed: number }

/**
 * Loads the `log-show` of each item through the streaming route, calling `onEvent` per line.
 * One request for every log — Server Actions run one at a time per client, so N actions would queue.
 */
export async function streamLogDetails(
  body: { credentials: unknown; items: { id: number; categoriesId: string }[] },
  onEvent: (event: LogDetailsEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/rubeus-logs/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? `Falha ao carregar os detalhes (HTTP ${res.status})`)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) onEvent(JSON.parse(line) as LogDetailsEvent)
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as LogDetailsEvent)
}
