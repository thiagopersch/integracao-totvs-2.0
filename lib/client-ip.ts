/**
 * Best-effort client IP for rate limiting. Behind Vercel / the nginx in docker-compose the proxy sets
 * `x-real-ip` / the first `x-forwarded-for` hop; without a proxy these headers are client-controlled,
 * so limits keyed on this are always combined with something the client can't rotate freely (e.g.
 * the target e-mail).
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
