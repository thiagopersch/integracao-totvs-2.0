import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis client (Vercel Marketplace injects KV_REST_API_* or UPSTASH_REDIS_REST_*),
 * or null when it isn't configured — every caller has an in-memory/inline fallback so local dev and
 * Docker keep working without Redis.
 */
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

export const redis: Redis | null = globalForRedis.redis ?? (url && token ? new Redis({ url, token }) : null);
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export const hasRedis = redis !== null;

/**
 * Read-through JSON cache in Redis for results of slow external calls (no-op without Redis).
 * Pass `refresh: true` to bypass and overwrite the cached value.
 */
export async function cachedJson<T>(key: string, ttlSeconds: number, load: () => Promise<T>, options: { refresh?: boolean } = {}): Promise<T> {
  if (!redis) return load();
  if (!options.refresh) {
    try {
      const hit = await redis.get<T>(key);
      if (hit !== null && hit !== undefined) return hit;
    } catch {
      // Redis down → behave as a miss
    }
  }
  const value = await load();
  await redis.set(key, value, { ex: ttlSeconds }).catch(() => {});
  return value;
}
