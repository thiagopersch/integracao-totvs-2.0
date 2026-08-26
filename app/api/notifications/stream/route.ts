import { getRequestContext } from "@/lib/tenant";
import { subscribe } from "@/lib/notification-events";

// No `dynamic`/`runtime` segment config here — incompatible with this project's
// `cacheComponents` (see next.config.ts). getRequestContext() below reads cookies via
// auth(), a request-time API, which already excludes this route from prerendering.

const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(request: Request) {
  const { userId } = await getRequestContext();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client already gone — cleanup below will run on the abort event.
        }
      }

      send("ready", { ok: true });

      const unsubscribe = subscribe(userId, (notification) => send("notification", notification));

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // ignore — cleanup runs on abort
        }
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
