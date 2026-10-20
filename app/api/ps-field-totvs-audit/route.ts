import { requirePermission } from "@/lib/rbac"
import { logApiCall, logAndNotifyFailure, sessionErrorMessage } from "@/lib/ps-docs/api-helpers"
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client"
import { runTotvsFieldAudit } from "@/lib/ps-docs/server/totvs-field-audit"
import type { TotvsAuditEvent } from "@/lib/ps-docs/field-search-stream"
import { psCredentialsSchema } from "@/schemas/ps-docs.schema"

// No `dynamic`/`runtime` segment config — incompatible with this project's `cacheComponents`;
// reading the session (auth()) already makes this route request-time.

/** "Buscar elementos → Integração TOTVS dos campos": checks every field of the registry for its
 *  TOTVS table/field/alternative name and streams the rows back as NDJSON (`TotvsAuditEvent`). */
export async function POST(request: Request) {
  let ctx: { organizationId: string; userId: string }
  try {
    ctx = await requirePermission("ps_field_search", "execute")
  } catch {
    return Response.json({ error: "Sem permissão" }, { status: 403 })
  }

  const parsed = psCredentialsSchema.safeParse(await request.json().catch(() => undefined))
  if (!parsed.success)
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 })
  const data = parsed.data

  const client = createRubeusClient(
    { session: data.session, xsrf: data.xsrf, clientId: data.clientId, branch: data.branch },
    { signal: request.signal }
  )
  const url = "https://admin.portal.apprbs.com.br/api/settings/fields (integração TOTVS dos campos)"

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const emit = (event: TotvsAuditEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          closed = true // client gone — the abort signal stops the remaining requests
        }
      }
      const startedAt = Date.now()
      try {
        const stats = await runTotvsFieldAudit(client, emit)
        await logApiCall({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          integration: "PS_DOCS",
          url,
          httpMethod: "GET",
          httpStatus: 200,
          requestSummary: { clientId: data.clientId },
          responseSummary: { ...stats, requisicoes: client.requestCount, duracaoMs: Date.now() - startedAt },
        })
      } catch (error) {
        if (!request.signal.aborted) {
          emit({ type: "error", error: sessionErrorMessage(error) ?? (error as Error).message })
          await logAndNotifyFailure({
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            url,
            method: "GET",
            idPs: "-",
            error,
          })
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
