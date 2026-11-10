import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

/**
 * Cross-instance mutual exclusion for scheduler ticks: Redis `SET key token NX PX ttl`, released
 * only by its owner (compare-and-delete in a Lua script). Replaces the Postgres advisory locks,
 * which were taken and released through the connection *pool* — the unlock could run on another
 * connection than the lock, leaving it held (ticks silently skipped) or letting two run at once.
 *
 * Without Redis (local dev, single Docker container) it falls back to an in-process lock, which is
 * enough there: only one process runs the schedulers.
 */
const localLocks = new Map<string, number>();

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export async function acquireLock(name: string, ttlMs: number): Promise<string | null> {
  const token = randomUUID();
  if (redis) {
    const ok = await redis.set(`lock:${name}`, token, { nx: true, px: ttlMs });
    return ok === "OK" ? token : null;
  }
  const heldUntil = localLocks.get(name);
  if (heldUntil && heldUntil > Date.now()) return null;
  localLocks.set(name, Date.now() + ttlMs);
  return token;
}

export async function releaseLock(name: string, token: string): Promise<void> {
  if (redis) {
    await redis.eval(RELEASE_SCRIPT, [`lock:${name}`], [token]).catch(() => {});
    return;
  }
  localLocks.delete(name);
}

/** Runs `fn` only if the lock is free; returns `{ skipped: true }` otherwise. The TTL bounds how long a crashed holder blocks others. */
export async function withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<{ skipped: true } | { skipped: false; value: T }> {
  const token = await acquireLock(name, ttlMs);
  if (!token) return { skipped: true };
  try {
    return { skipped: false, value: await fn() };
  } finally {
    await releaseLock(name, token);
  }
}
