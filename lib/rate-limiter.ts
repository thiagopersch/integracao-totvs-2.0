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
