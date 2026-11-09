import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

/**
 * Remembers, for a short time, that a TBC accepted AutenticaAcesso + CheckServiceActivity for a
 * given web service — so a SOAP execution makes 1 HTTP call instead of 3 (and writes 1 log instead
 * of 3). The key hashes the link, user, stored (encrypted) password and ws name: changing any of
 * them — e.g. a new password — misses the cache and authenticates again. Shared through Redis when
 * configured, per-process otherwise. "Testar conexão" never reads it.
 */
const TTL_SECONDS = Number(process.env.SOAP_AUTH_CACHE_TTL_SECONDS ?? 300);
const memory = new Map<string, number>();

export function soapAuthCacheKey(tbc: { link: string; user: string; password: string }, wsName: string): string {
  const digest = createHash("sha256").update(`${tbc.link}\u0000${tbc.user}\u0000${tbc.password}\u0000${wsName}`).digest("hex");
  return `soap-auth:${digest}`;
}

export async function isSoapAuthCached(key: string): Promise<boolean> {
  if (TTL_SECONDS <= 0) return false;
  if (redis) {
    try {
      return (await redis.exists(key)) === 1;
    } catch {
      return false;
    }
  }
  const expiresAt = memory.get(key);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    memory.delete(key);
    return false;
  }
  return true;
}

export async function rememberSoapAuth(key: string): Promise<void> {
  if (TTL_SECONDS <= 0) return;
  if (redis) {
    await redis.set(key, "1", { ex: TTL_SECONDS }).catch(() => {});
    return;
  }
  memory.set(key, Date.now() + TTL_SECONDS * 1000);
  if (memory.size > 1000) {
    const now = Date.now();
    for (const [k, exp] of memory) if (exp < now) memory.delete(k);
  }
}

export async function forgetSoapAuth(key: string): Promise<void> {
  memory.delete(key);
  if (redis) await redis.del(key).catch(() => {});
}
