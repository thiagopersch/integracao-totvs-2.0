import { getIntegrationConfig } from "@/lib/integration-config"
import { requirePermission } from "@/lib/rbac"
import { logApiCall, logAndNotifyFailure, sessionErrorMessage } from "@/lib/ps-docs/api-helpers"
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client"
import type { LogDetailsEvent } from "@/lib/rubeus-logs/details-stream"
import { LOGS_API_ROOT, showLog, timeoutMessage } from "@/lib/rubeus-logs/server/logs-api"
import { logDetailsSchema } from "@/schemas/rubeus-logs.schema"

// No `dynamic`/`runtime` segment config — incompatible with this project's `cacheComponents`;
// reading the session (auth()) already makes this route request-time.

const CONCURRENCY = 5

/** "Análise de logs → exportar com detalhes": the `log-show` of every chosen log in ONE request,
 *  streamed back as NDJSON (`LogDetailsEvent` per line) so the dialog can show progress. */
export async function POST(request: Request) {
  let ctx: { organizationId: string; userId: string }
  try {
    ctx = await requirePermission("ps_log_analysis", "execute")
  } catch {
    return Response.json({ error: "Sem permissão" }, { status: 403 })
  }

  const parsed = logDetailsSchema.safeParse(await request.json().catch(() => undefined))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 })
  const { credentials, items } = parsed.data

  const client = createRubeusClient(credentials, {
    concurrency: CONCURRENCY,
    signal: request.signal,
    timeoutMs: (await getIntegrationConfig(ctx.organizationId, "RUBEUS")).timeoutMs,
  })
  const url = `${LOGS_API_ROOT}/log-show (exportação)`

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const emit = (event: LogDetailsEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          closed = true // client gone — the abort signal stops the remaining requests
        }
      }
      const startedAt = Date.now()
      let loaded = 0
      let failed = 0
      let sessionError: string | undefined
      try {
        await Promise.all(
          items.map(async ({ id, categoriesId }) => {
            if (sessionError || request.signal.aborted) return
            try {
              const log = await showLog(client, { categoriesId, id })
              loaded++
              emit({ type: "detail", log })
            } catch (error) {
              if (request.signal.aborted) return
              // An expired session fails every request — stop and report it once.
              const session = sessionErrorMessage(error)
              if (session) {
                sessionError ??= session
                return
              }
              failed++
              emit({ type: "failed", id, error: timeoutMessage(error) ?? (error as Error).message })
            }
          })
        )
        if (sessionError) throw new Error(sessionError)
        if (!request.signal.aborted) emit({ type: "done", loaded, failed })
        await logApiCall({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          integration: "PS_DOCS",
          url,
          httpMethod: "POST",
          httpStatus: 200,
          requestSummary: { logs: items.length },
          responseSummary: { carregados: loaded, falhas: failed, requisicoes: client.requestCount, duracaoMs: Date.now() - startedAt },
        })
      } catch (error) {
        if (!request.signal.aborted) {
          emit({ type: "error", error: sessionErrorMessage(error) ?? (error as Error).message })
          await logAndNotifyFailure({ organizationId: ctx.organizationId, userId: ctx.userId, url, method: "POST", idPs: String(items[0]?.id ?? "-"), error })
        }
      } finally {
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
