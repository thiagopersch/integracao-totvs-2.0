import { ForbiddenError, requirePermission } from "@/lib/rbac"
import { analyzeSqlQuerySchema } from "@/schemas/sql-docs.schema"
import { sqlDocsService } from "@/services/sql-docs.service"

// A large query keeps the model writing for over a minute; as a Server Action it would inherit the
// page's timeout. Literal read at build time — keep it 20 s above AI_TIMEOUT_MAX_SECONDS (lib/ai/types).
export const maxDuration = 300

/**
 * Analyses one SQL query with the configured AI and streams NDJSON: `{"type":"delta","chunk":"…"}`
 * while the model writes, then one `{"type":"done","result":{success,entry|error}}`.
 */
export async function POST(request: Request) {
  let organizationId: string
  try {
    ;({ organizationId } = await requirePermission("sql_docs", "execute"))
  } catch (error) {
    const message = error instanceof ForbiddenError ? error.message : "Sessão expirada. Faça login novamente."
    return Response.json({ type: "done", result: { success: false, error: message } }, { status: 403 })
  }

  const parsed = analyzeSqlQuerySchema.safeParse(await request.json().catch(() => undefined))
  if (!parsed.success) {
    return Response.json({ type: "done", result: { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" } }, { status: 400 })
  }

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
        const entry = await sqlDocsService.analyze(organizationId, parsed.data, (chunk) => write({ type: "delta", chunk }))
        write({ type: "done", result: { success: true, entry } })
      } catch (error) {
        write({ type: "done", result: { success: false, error: (error as Error).message } })
      } finally {
        controller.close()
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
