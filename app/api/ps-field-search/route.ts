import { requirePermission } from "@/lib/rbac";
import { logApiCall, logAndNotifyFailure, sessionErrorMessage } from "@/lib/ps-docs/api-helpers";
import { createRubeusClient } from "@/lib/ps-docs/server/rubeus-client";
import { runFieldSearchSweep, type SweepInput } from "@/lib/ps-docs/server/field-search-sweep";
import type { SweepEvent } from "@/lib/ps-docs/field-search-stream";
import { psDocsSchema } from "@/schemas/ps-docs.schema";

// No `dynamic`/`runtime` segment config — incompatible with this project's `cacheComponents`;
// reading the session (auth()) already makes this route request-time.

/** "Buscar elementos": reads the whole chosen scope in ONE request and streams it back as NDJSON
 *  (`SweepEvent` per line). Replaces the dozens of Server Actions the page used to call — Next
 *  dispatches those one at a time per client, so their "parallel" calls ran in a queue. */
export async function POST(request: Request) {
  let ctx: { organizationId: string; userId: string };
  try {
    ctx = await requirePermission("ps_field_search", "execute");
  } catch {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = psDocsSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
  const data = parsed.data;

  const input: SweepInput =
    data.docMode === "processo"
      ? { docMode: "processo", idPs: data.idPs, crmDomain: data.crmDomain }
      : data.docMode === "portal"
        ? { docMode: "portal", idPortal: data.idPortal, localId: data.localId, crmDomain: data.crmDomain }
        : { docMode: "ambiente" };
  const client = createRubeusClient({ session: data.session, xsrf: data.xsrf, clientId: data.clientId, branch: data.branch }, { signal: request.signal });
  const url = "https://admin.portal.apprbs.com.br/api (busca de elementos)";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const emit = (event: SweepEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true; // client gone — the abort signal stops the remaining requests
        }
      };
      const startedAt = Date.now();
      try {
        const stats = await runFieldSearchSweep(client, input, emit);
        await logApiCall({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          integration: "PS_DOCS",
          url,
          httpMethod: "POST",
          httpStatus: 200,
          requestSummary: { docMode: data.docMode, idPs: data.idPs || undefined, idPortal: data.idPortal || undefined },
          responseSummary: { ...stats, requisicoes: client.requestCount, duracaoMs: Date.now() - startedAt },
        });
      } catch (error) {
        if (!request.signal.aborted) {
          emit({ type: "error", error: sessionErrorMessage(error) ?? (error as Error).message });
          await logAndNotifyFailure({ organizationId: ctx.organizationId, userId: ctx.userId, url, method: "POST", idPs: data.idPs || data.idPortal || "-", error });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
