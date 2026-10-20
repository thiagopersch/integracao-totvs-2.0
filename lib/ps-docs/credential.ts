/** Pure (client-safe) types/helpers for the PS Docs portal-admin session. The admin authenticates
 *  via Laravel session cookies (no JWT/localStorage token anymore): the user pastes the whole
 *  `Cookie` header of a request to admin.portal.apprbs.com.br (DevTools → Network) and
 *  `parseCookieString` extracts the four values from it. */

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

const REQUIRED_COOKIES = ["client_id", "inscricoes_session", "XSRF-TOKEN"] as const;

/** Splits a pasted cookie string (`a=1; b=2`, optionally prefixed by `Cookie:` and/or broken
 *  across lines) into a lowercase-name → value map. Splits each pair on the FIRST `=` only, since
 *  the values are base64 and may end in `=`. */
function cookieMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const text = raw.trim().replace(/^cookie\s*:/i, "");
  for (const part of text.split(/[;\r\n]+/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (name && value) map.set(name, value);
  }
  return map;
}

/** Extracts the portal-admin credentials from the pasted `Cookie` string. Unknown cookies are
 *  ignored; a missing `branch` falls back to `master`. */
export function parseCookieString(raw: string): PsCredentials {
  const map = cookieMap(raw);
  return {
    session: map.get("inscricoes_session") ?? "",
    xsrf: map.get("xsrf-token") ?? "",
    clientId: map.get("client_id") ?? "",
    branch: map.get("branch") ?? "master",
  };
}

/** Required cookies absent from the pasted string (empty when it is complete). */
export function missingCookieNames(raw: string): string[] {
  const map = cookieMap(raw);
  return REQUIRED_COOKIES.filter((name) => !map.has(name.toLowerCase()));
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
