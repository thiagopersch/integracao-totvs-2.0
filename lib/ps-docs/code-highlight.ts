import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import json from "highlight.js/lib/languages/json";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("json", json);

export type CodeLang = "javascript" | "css" | "html" | "sql" | "json";

export interface CodeToken {
  text: string;
  /** Top-level highlight.js scope (e.g. "keyword", "string"), or undefined for plain text. */
  kind?: string;
}

export interface CodeTheme {
  color: string;
  bold?: boolean;
  italic?: boolean;
}

/** Fixed One Dark Pro theme, shared by the HTML preview / Google Docs and .docx exports. */
export const CODE_BACKGROUND = "#282c34";
export const CODE_BORDER = "#181a1f";
export const CODE_PLAIN_COLOR = "#abb2bf";
export const CODE_FONT = "JetBrains Mono";

const THEME: Record<string, CodeTheme> = {
  keyword: { color: "#c678dd" },
  operator: { color: "#56b6c2" },
  built_in: { color: "#e5c07b" },
  type: { color: "#e5c07b" },
  class: { color: "#e5c07b" },
  literal: { color: "#d19a66" },
  number: { color: "#d19a66" },
  string: { color: "#98c379" },
  regexp: { color: "#98c379" },
  symbol: { color: "#98c379" },
  comment: { color: "#7f848e", italic: true },
  doctag: { color: "#c678dd" },
  title: { color: "#61afef" },
  function: { color: "#61afef" },
  params: { color: CODE_PLAIN_COLOR },
  attr: { color: "#d19a66" },
  attribute: { color: "#d19a66" },
  variable: { color: "#e06c75" },
  property: { color: "#e06c75" },
  name: { color: "#e06c75" },
  tag: { color: "#e06c75" },
  selector: { color: "#e06c75" },
  "selector-tag": { color: "#e06c75" },
  "selector-class": { color: "#d19a66" },
  "selector-id": { color: "#61afef" },
  "selector-attr": { color: "#d19a66" },
  meta: { color: "#56b6c2" },
  punctuation: { color: CODE_PLAIN_COLOR },
  subst: { color: CODE_PLAIN_COLOR },
};

export function themeFor(kind: string | undefined): CodeTheme {
  if (!kind) return { color: CODE_PLAIN_COLOR };
  const base = kind.split(".")[0].replace(/^title$/, "title");
  return THEME[kind] ?? THEME[base] ?? { color: CODE_PLAIN_COLOR };
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#x27;": "'", "&#39;": "'" };
const decode = (s: string) => s.replace(/&(lt|gt|amp|quot|#x27|#39);/g, (m) => ENTITIES[m] ?? m);

/** Picks the highlight.js language for a snippet; `hint` wins when given. */
export function detectLang(code: string, hint?: CodeLang | "script" | "html"): CodeLang {
  if (hint === "javascript" || hint === "css" || hint === "sql" || hint === "json") return hint;
  const trimmed = code.trimStart();
  if (hint === "script") return trimmed.startsWith("<") ? "html" : "javascript";
  if (hint === "html") return "html";
  if (trimmed.startsWith("<")) return "html";
  const auto = hljs.highlightAuto(code, ["javascript", "css", "sql", "json", "xml"]).language;
  return auto === "xml" ? "html" : ((auto as CodeLang | undefined) ?? "javascript");
}

/** Highlights `code` into flat tokens (top-level scope only; nested spans inherit the outer kind
 *  unless the inner one is themed, in which case the innermost themed scope wins). */
export function tokenize(code: string, lang: CodeLang): CodeToken[] {
  const html = hljs.highlight(code, { language: lang === "html" ? "xml" : lang, ignoreIllegals: true }).value;
  const tokens: CodeToken[] = [];
  const stack: (string | undefined)[] = [];
  const re = /<span class="hljs-([^"]*)">|<\/span>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      const kind = m[1].split(" ")[0].replace(/^language-/, "");
      stack.push(kind);
    } else if (m[2] !== undefined) {
      const kind = [...stack].reverse().find((k) => k && (THEME[k] || THEME[k.split(".")[0]])) ?? stack[stack.length - 1];
      tokens.push({ text: decode(m[2]), kind });
    } else {
      stack.pop();
    }
  }
  return tokens;
}

/** Splits tokens into lines (each a list of tokens), preserving indentation. */
export function tokenLines(code: string, lang: CodeLang): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const t of tokenize(code, lang)) {
    const parts = t.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: t.kind });
    });
  }
  return lines;
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `<pre>` block with inline-styled spans — works in the preview and pastes into Google Docs. */
export function codeBlockHtml(code: string, lang: CodeLang): string {
  const spans = tokenize(code, lang)
    .map((t) => {
      const th = themeFor(t.kind);
      const style = `color:${th.color};${th.bold ? "font-weight:700;" : ""}${th.italic ? "font-style:italic;" : ""}`;
      return `<span style="${style}">${escHtml(t.text)}</span>`;
    })
    .join("");
  return `<pre style="font-family:var(--font-jetbrains-mono),'${CODE_FONT}','Courier New',monospace;font-weight:700;font-size:9.5pt;line-height:1.45;background:${CODE_BACKGROUND};color:${CODE_PLAIN_COLOR};border:1px solid ${CODE_BORDER};border-radius:4px;padding:10px 12px;margin:6px 0 10px 0;white-space:pre;overflow:auto;"><code style="font-family:inherit;font-weight:700;">${spans}</code></pre>`;
}

/** Markdown fence tag for a language. */
export const fenceTag = (lang: CodeLang): string => (lang === "javascript" ? "js" : lang);
