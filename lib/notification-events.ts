import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import type { Notification } from "@prisma/client";

/**
 * Cross-instance pub/sub for live-pushing new notifications to the SSE route, backed by
 * Postgres LISTEN/NOTIFY. A plain in-process EventEmitter only works within a single Node
 * process — on Vercel (or any horizontally-scaled deployment) the invocation that creates a
 * notification and the one holding the SSE connection open are typically different isolated
 * processes, so nothing would ever reach the listener. LISTEN/NOTIFY fans the event out through
 * Postgres itself instead. The NOTIFY payload carries only the notification id (kept far under
 * Postgres's 8000-byte payload cap); the SSE side re-fetches the row, which also re-scopes it to
 * the subscribing user.
 */
const CHANNEL = "app_notifications";

export async function emitToUser(userId: string, notification: Notification): Promise<void> {
  await prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify({ userId, id: notification.id })})`;
}

export function subscribe(userId: string, listener: (notification: Notification) => void): () => void {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let closed = false;

  client.on("notification", async (msg) => {
    if (!msg.payload) return;
    try {
      const payload = JSON.parse(msg.payload) as { userId: string; id: string };
      if (payload.userId !== userId) return;
      const notification = await prisma.notification.findUnique({ where: { id: payload.id } });
      if (notification) listener(notification);
    } catch (err) {
      console.error("[notification-events] failed to handle NOTIFY payload:", err);
    }
  });

  client.on("error", (err) => {
    console.error("[notification-events] LISTEN connection error:", err);
  });

  const ready = client
    .connect()
    .then(async () => {
      if (closed) {
        await client.end().catch(() => {});
        return;
      }
      await client.query(`LISTEN ${CHANNEL}`);
    })
    .catch((err) => {
      console.error("[notification-events] failed to establish LISTEN connection:", err);
    });

  return () => {
    closed = true;
    ready.finally(() => {
      client.end().catch(() => {});
    });
  };
}
