/**
 * "Link do app": links stored as a path (`/contracts/123`) and prefixed at render time with
 * `{{appUrl}}` — the sending environment's own address (NEXT_PUBLIC_APP_URL; the browser origin
 * in the builder preview). A full URL pasted into the field keeps only its path/query/hash, so
 * a link copied from localhost still works in production.
 */
export type LinkType = "app" | "url";

export function toAppPath(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\{\{\s*appUrl\s*\}\}/.test(raw)) return toAppPath(raw.replace(/^\{\{\s*appUrl\s*\}\}/, "") || "/");
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return "/";
    }
  }
  // Variables are kept as-is (e.g. "/contracts/{{clientId}}"); a bare "contracts" gets its slash.
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Final href template for a link: app paths become `{{appUrl}}/path`, own URLs stay as typed. */
export function resolveLinkHref(href: string | undefined, linkType: LinkType | undefined): string {
  const value = (href ?? "").trim();
  if (!value) return "";
  return linkType === "app" ? `{{appUrl}}${toAppPath(value)}` : value;
}
