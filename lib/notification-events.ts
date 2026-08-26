import { EventEmitter } from "node:events";
import type { Notification } from "@prisma/client";

/**
 * In-process pub/sub for live-pushing new notifications to the SSE route. Single Node instance,
 * no horizontal scaling (see docker-compose.yml — one `app` service, no Redis) — so a plain
 * EventEmitter is enough; a multi-instance deployment would need a shared broker (Redis pub/sub)
 * to fan events out across processes.
 */
const emitter = new EventEmitter();
// Many browser tabs/users can subscribe concurrently — raise the default cap to avoid Node's
// "MaxListenersExceededWarning" noise in normal operation.
emitter.setMaxListeners(1000);

function channel(userId: string): string {
  return `notification:${userId}`;
}

export function emitToUser(userId: string, notification: Notification): void {
  emitter.emit(channel(userId), notification);
}

export function subscribe(userId: string, listener: (notification: Notification) => void): () => void {
  emitter.on(channel(userId), listener);
  return () => emitter.off(channel(userId), listener);
}
