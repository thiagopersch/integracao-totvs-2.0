import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { AUTH_CONFIG } from "@/config/auth.config";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  window: number = AUTH_CONFIG.RATE_LIMIT.API.window,
  max: number = AUTH_CONFIG.RATE_LIMIT.API.max
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + window });
    return { allowed: true, remaining: max - 1, resetAt: now + window };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);

  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining, resetAt: entry.resetAt };
}

// ── Shared (multi-instance) limiter ──────────────────────────────────────────


export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

const limiters = new Map<string, Ratelimit>();

function sharedLimiter(window: number, max: number): Ratelimit | null {
  if (!redis) return null;
  const id = `${window}:${max}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${window} ms`),
      prefix: `rl:${id}`,
      // Keys already over the limit are rejected from memory until their reset, without a round trip.
      ephemeralCache: new Map(),
      // Redis slow/unreachable → let the request through rather than take the app down with it.
      timeout: 1000,
      analytics: false,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

/**
 * Same contract as {@link checkRateLimit}, but counted in Upstash Redis (sliding window) so the
 * limit holds across every serverless instance. Falls back to the per-process counter when Redis
 * isn't configured (local dev, Docker).
 */
export async function rateLimit(
  key: string,
  window: number = AUTH_CONFIG.RATE_LIMIT.API.window,
  max: number = AUTH_CONFIG.RATE_LIMIT.API.max
): Promise<RateLimitResult> {
  const limiter = sharedLimiter(window, max);
  if (!limiter) return checkRateLimit(key, window, max);
  try {
    const result = await limiter.limit(key);
    return { allowed: result.success, remaining: result.remaining, resetAt: result.reset };
  } catch {
    return checkRateLimit(key, window, max);
  }
}
