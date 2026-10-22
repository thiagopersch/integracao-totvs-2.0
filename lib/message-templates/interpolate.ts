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

const REPEAT_RE = /<!--repeat-->([\s\S]*?)<!--endrepeat-->/g;
const ROW_REPEAT_RE = /<!--rowrepeat-->([\s\S]*?)<!--endrowrepeat-->/g;

/**
 * Fills a rendered body: resolves conditionals and `{{variables}}`. Segments wrapped in
 * `<!--repeat-->…<!--endrepeat-->` (containers with `repeatPerClient`) are rendered once per entry
 * of `clients`, each with `{ ...vars, ...client }` — or once with `vars` when `clients` is absent
 * (per-client emails). Table rows wrapped in `<!--rowrepeat-->…<!--endrowrepeat-->` (TableBlock
 * `repeatRows`) are repeated the same way, giving one table with a row per client; inside a repeated
 * container they render once, with that container's client. Each segment is interpolated on its own
 * so values are never re-expanded.
 */
export function fillTemplateHtml(html: string, vars: Record<string, unknown>, clients?: Record<string, unknown>[]): string {
  const fill = (segment: string, scope: Record<string, unknown>, rowClients?: Record<string, unknown>[]) => {
    const resolved = applyConditionals(segment, scope);
    let out = "";
    let last = 0;
    for (const match of resolved.matchAll(ROW_REPEAT_RE)) {
      out += interpolate(resolved.slice(last, match.index), scope);
      const inner = match[1];
      out += rowClients ? rowClients.map((client) => interpolate(inner, { ...scope, ...client })).join("") : interpolate(inner, scope);
      last = match.index + match[0].length;
    }
    return out + interpolate(resolved.slice(last), scope);
  };
  let out = "";
  let last = 0;
  for (const match of html.matchAll(REPEAT_RE)) {
    out += fill(html.slice(last, match.index), vars, clients);
    const inner = match[1];
    out += clients ? clients.map((client) => fill(inner, { ...vars, ...client })).join("") : fill(inner, vars);
    last = match.index + match[0].length;
  }
  return out + fill(html.slice(last), vars, clients);
}

/** Plain-text version of an HTML body (email `text` part). Keeps paragraph/line breaks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Mobile card labels (render-email renderTable) repeat the table header — not text content.
    .replace(/<span class="mt-label"[^>]*>[\s\S]*?<\/span>/g, "")
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
