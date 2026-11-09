import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Notification } from "@/generated/prisma/client";

/**
 * Cross-instance pub/sub for live-pushing new notifications to the SSE route, backed by Postgres
 * LISTEN/NOTIFY (the invocation that creates a notification and the one holding the SSE stream are
 * usually different processes on Vercel).
 *
 * Each server instance holds ONE dedicated LISTEN connection, opened when the first tab subscribes
 * and closed shortly after the last one leaves, and fans events out in memory to that instance's
 * open streams (it used to open one Postgres connection per browser tab). LISTEN needs a session,
 * which a transaction pooler (Neon/PgBouncer) doesn't keep — so it uses the unpooled URL.
 *
 * The NOTIFY payload carries the notification itself (no re-fetch per tab); rows too big for
 * Postgres's 8000-byte payload cap send only the id and are fetched once.
 */
const CHANNEL = "app_notifications";
const MAX_PAYLOAD_BYTES = 7500;
const IDLE_CLOSE_MS = 30_000;
const RECONNECT_MS = 3_000;

type Listener = (notification: Notification) => void;
type Payload = { userId: string; id: string; notification?: Notification };

function listenUrl() {
  return process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL;
}

export async function emitToUser(userId: string, notification: Notification): Promise<void> {
  let payload = JSON.stringify({ userId, id: notification.id, notification } satisfies Payload);
  if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) payload = JSON.stringify({ userId, id: notification.id } satisfies Payload);
  await prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${payload})`;
}

/** Dates arrive as ISO strings after the JSON round trip. */
function revive(notification: Notification): Notification {
  return {
    ...notification,
    createdAt: new Date(notification.createdAt),
    readAt: notification.readAt ? new Date(notification.readAt) : null,
  };
}

class NotificationHub {
  private listeners = new Map<string, Set<Listener>>();
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(userId: string, listener: Listener): () => void {
    const set = this.listeners.get(userId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(userId, set);
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    void this.ensureConnected();

    return () => {
      const current = this.listeners.get(userId);
      current?.delete(listener);
      if (current && current.size === 0) this.listeners.delete(userId);
      if (this.listeners.size === 0) this.scheduleIdleClose();
    };
  }

  get subscriberCount() {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }

  private ensureConnected(): Promise<void> {
    if (this.client) return Promise.resolve();
    if (this.connecting) return this.connecting;
    const client = new Client({ connectionString: listenUrl() });
    client.on("notification", (msg) => void this.handle(msg.payload));
    client.on("error", (err) => {
      logger.error("[notification-events] LISTEN connection error", { error: err.message });
      this.dropClient(client);
      this.scheduleReconnect();
    });
    client.on("end", () => {
      if (this.client === client) {
        this.dropClient(client);
        this.scheduleReconnect();
      }
    });
    this.connecting = client
      .connect()
      .then(() => client.query(`LISTEN ${CHANNEL}`))
      .then(() => {
        this.client = client;
      })
      .catch((err) => {
        logger.error("[notification-events] failed to establish LISTEN connection", { error: (err as Error).message });
        client.end().catch(() => {});
        this.scheduleReconnect();
      })
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  private dropClient(client: Client) {
    if (this.client === client) this.client = null;
    client.removeAllListeners("notification");
    client.end().catch(() => {});
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.listeners.size === 0) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.listeners.size > 0) void this.ensureConnected();
    }, RECONNECT_MS);
  }

  private scheduleIdleClose() {
    if (this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.listeners.size > 0 || !this.client) return;
      const client = this.client;
      this.client = null;
      client.end().catch(() => {});
    }, IDLE_CLOSE_MS);
  }

  private async handle(raw: string | undefined) {
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as Payload;
      const targets = this.listeners.get(payload.userId);
      if (!targets?.size) return;
      const notification = payload.notification
        ? revive(payload.notification)
        : await prisma.notification.findFirst({ where: { id: payload.id, userId: payload.userId } });
      if (!notification) return;
      for (const listener of targets) listener(notification);
    } catch (err) {
      logger.error("[notification-events] failed to handle NOTIFY payload", { error: (err as Error).message });
    }
  }
}

const globalForHub = globalThis as unknown as { notificationHub?: NotificationHub };
const hub = (globalForHub.notificationHub ??= new NotificationHub());

export function subscribe(userId: string, listener: Listener): () => void {
  return hub.subscribe(userId, listener);
}
