/** Pure (client-safe) types/helpers for the PS Docs portal-admin session. The admin authenticates
 *  via Laravel session cookies (no JWT/localStorage token anymore): the user copies four cookie
 *  values from DevTools → Application → Cookies → admin.portal.apprbs.com.br. */

export const ADMIN_ORIGIN = "https://admin.portal.apprbs.com.br";

export interface PsCredentials {
  /** Cookie `inscricoes_session` (proves the login). */
  session: string;
  /** Cookie `XSRF-TOKEN` (also sent as the `X-XSRF-TOKEN` header). */
  xsrf: string;
  /** Cookie `client_id`. */
  clientId: string;
  /** Cookie `branch` (usually `master`). */
  branch: string;
}

export const EMPTY_CREDENTIALS: PsCredentials = { session: "", xsrf: "", clientId: "", branch: "master" };

export function hasRequiredCredentials(c: PsCredentials): boolean {
  return !!(c.session.trim() && c.xsrf.trim() && c.clientId.trim() && c.branch.trim());
}

/** Tolerates a value pasted as `nome=valor` (or with a trailing `;`) — keeps only the value. */
export function cookieValue(name: string, raw: string): string {
  let v = raw.trim().replace(/;$/, "");
  const prefix = `${name}=`;
  if (v.toLowerCase().startsWith(prefix.toLowerCase())) v = v.slice(prefix.length);
  return v;
}

/** `X-XSRF-TOKEN` header = URL-decoded `XSRF-TOKEN` cookie (Laravel convention). */
export function decodeXsrf(xsrf: string): string {
  const v = cookieValue("XSRF-TOKEN", xsrf);
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function buildCookieHeader(c: PsCredentials): string {
  return [
    `branch=${cookieValue("branch", c.branch)}`,
    `client_id=${cookieValue("client_id", c.clientId)}`,
    `inscricoes_session=${cookieValue("inscricoes_session", c.session)}`,
    `XSRF-TOKEN=${cookieValue("XSRF-TOKEN", c.xsrf)}`,
  ].join("; ");
}
