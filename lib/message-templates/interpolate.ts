/** Escapes a value for safe use in HTML text and in double/single-quoted attributes. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Replaces flat `{{key}}` tokens with their values. Missing keys become "". With `escape` (the
 * default — used for HTML bodies), values are HTML-escaped so data coming from the system (client
 * names, error messages…) can never inject markup into an email.
 */
export function interpolate(text: string, vars: Record<string, unknown>, options: { escape?: boolean } = {}): string {
  const escape = options.escape ?? true;
  return text.replace(TOKEN_RE, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    const str = String(value);
    return escape ? escapeHtml(str) : str;
  });
}

/**
 * Resolves the `<!--cond:key-->…<!--endcond-->` markers emitted by render-email.ts for rows and
 * containers with `visibleIf`: keeps the content when `vars[key]` is non-empty, drops it otherwise.
 * Must run before `interpolate`.
 */
export function applyConditionals(html: string, vars: Record<string, unknown>): string {
  return html.replace(/<!--cond:(\w+)-->([\s\S]*?)<!--endcond-->/g, (_match, key: string, inner: string) => {
    const value = vars[key];
    return value !== undefined && value !== null && value !== "" && value !== false ? inner : "";
  });
}

/** Plain-text version of an HTML body (email `text` part). Keeps paragraph/line breaks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|tr|div|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Keys referenced as `{{key}}` in a string. */
export function extractVariableKeys(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN_RE)].map((m) => m[1]))];
}
