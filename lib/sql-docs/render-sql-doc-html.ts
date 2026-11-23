import { codeBlockHtml } from "@/lib/ps-docs/code-highlight";
import { RB33_CSS } from "@/lib/ps-docs/rb33-styles";
import { EDITOR_EDIT_CSS, EDITOR_SCRIPT, editorActionsHtml } from "@/lib/ps-docs/standalone-editor";
import type { StyleConfig } from "@/lib/ps-docs/types";
import { DEFAULT_SQL_DOC_OPTIONS, entryHeading, type SqlDocEntry, type SqlDocOptions, type SqlDocument } from "./types";

/** HTML of the "Mapeamento de consultas" (RB-34) document, in the RB-33 look. Same two skins as
 *  `lib/ps-docs/render-rb33-html.ts`: "inline" for the preview / Google Docs copy, "class" for the
 *  standalone `.html` (RB-33 design-system CSS, sidebar index, read-only text with "Editar textos"). */

type Skin = "inline" | "class";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TEAL_DEEP = "#004f4f";
const TEAL_BORDER = "#005c5c";
const MUTED = "#505353";
const BORDER = "#e1e3e2";

function inlineStyles(style: StyleConfig) {
  const font = `font-family:'${style.bodyFont}',sans-serif;`;
  return {
    h1: `font-family:'${style.titleFont}',sans-serif;color:${style.titleColor};font-size:24pt;font-weight:700;margin:0 0 4pt;`,
    subtitle: `font-family:monospace;color:${MUTED};font-size:9.5pt;margin:0 0 18pt;`,
    h2: `${font}color:${style.stageColor};font-size:15pt;font-weight:600;margin:24pt 0 6pt;`,
    summary: `${font}color:${MUTED};font-size:10.5pt;font-style:italic;line-height:1.5;margin:0 0 6pt;`,
    label: `${font}color:${TEAL_DEEP};font-size:10.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-left:3px solid ${TEAL_BORDER};padding-left:8px;margin:14pt 0 6pt;`,
    ul: `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`,
    li: `${font}color:${style.bodyColor};font-size:11pt;line-height:1.55;margin-bottom:4px;`,
    table: `border-collapse:collapse;width:100%;margin:0 0 8pt;${font}font-size:10pt;`,
    th: `border:1px solid ${BORDER};background:#eff1f0;color:#2e3131;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;letter-spacing:.04em;`,
    td: `border:1px solid ${BORDER};padding:6px 8px;vertical-align:top;color:${style.bodyColor};`,
    mono: `font-family:monospace;font-size:9pt;color:${TEAL_DEEP};`,
    muted: `color:${MUTED};font-style:italic;${font}font-size:11pt;`,
  };
}

type InlineKey = keyof ReturnType<typeof inlineStyles>;

const CLASS_OF: Partial<Record<InlineKey, string>> = {
  subtitle: "subtitle",
  summary: "section-body hint",
  label: "section-label",
  table: "actions-table",
  mono: "query-code",
  muted: "section-body hint",
};

function makeCtx(skin: Skin, style: StyleConfig) {
  const s = inlineStyles(style);
  return (key: InlineKey) => {
    if (skin === "inline") return ` style="${s[key]}"`;
    const cls = CLASS_OF[key];
    return cls ? ` class="${cls}"` : "";
  };
}

export function entryAnchor(e: SqlDocEntry, index: number): string {
  const base = (e.code || e.title || "consulta").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `q${index + 1}-${base}`;
}

function entryHtml(e: SqlDocEntry, index: number, skin: Skin, a: ReturnType<typeof makeCtx>, opts: SqlDocOptions): string {
  const label = (t: string) => (skin === "class" ? `<div class="section-label">${t}</div>` : `<p${a("label")}>${t}</p>`);
  const ul = (items: string[]) => `<ul${a("ul")}>${items.map((i) => `<li${a("li")}>${esc(i)}</li>`).join("")}</ul>`;
  const wrap = (html: string) => (skin === "class" ? `<div class="section-body">${html}</div>` : html);
  const table = (head: string[], rows: string[][]) =>
    `<table${a("table")}><thead><tr>${head.map((h) => `<th${a("th")}>${h}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td${a("td")}>${c}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;

  const parts: string[] = [`<h2${a("h2")}>${esc(entryHeading(e))}</h2>`];
  if (opts.includeSummary && e.summary) parts.push(`<p${a("summary")}>${esc(e.summary)}</p>`);
  parts.push(e.rules.length ? wrap(ul(e.rules)) : `<p${a("muted")}>Nenhuma regra registrada.</p>`);

  if (opts.includeTables) {
    if (e.parameters.length) parts.push(label("Parâmetros"), wrap(ul(e.parameters)));
    if (e.tables.length) {
      parts.push(
        label("Tabelas utilizadas"),
        table(
          ["Tabela", "Descrição", "Papel na consulta"],
          e.tables.map((t) => [`<span${a("mono")}>${esc(t.name)}${t.alias ? ` (${esc(t.alias)})` : ""}</span>`, esc(t.description ?? "—"), esc(t.role)])
        )
      );
    }
    if (e.fields.length) {
      parts.push(
        label("Campos utilizados"),
        table(
          ["Campo", "Descrição", "Uso"],
          e.fields.map((f) => [`<span${a("mono")}>${esc(f.table ? `${f.table}.${f.column}` : f.column)}</span>`, esc(f.description ?? "—"), esc(f.usage)])
        )
      );
    }
  }
  if (opts.includeSql && e.sql.trim()) parts.push(label("Sentença SQL"), codeBlockHtml(e.sql.trim(), "sql"));

  const inner = parts.join("");
  return skin === "class" ? `<section class="etapa" id="${esc(entryAnchor(e, index))}">${inner}</section>` : inner;
}

function docHtml(doc: SqlDocument, skin: Skin, style: StyleConfig, opts: SqlDocOptions): string {
  const a = makeCtx(skin, style);
  const h1 = `<h1${skin === "inline" ? a("h1") : ""}>${esc(doc.title)}</h1>`;
  const sub = doc.subtitle ? `<div${a("subtitle")}>${esc(doc.subtitle)}</div>` : "";
  const body = doc.entries.length ? doc.entries.map((e, i) => entryHtml(e, i, skin, a, opts)).join("") : `<p${a("muted")}>Nenhuma consulta documentada.</p>`;
  return `${h1}${sub}${body}`;
}

/** Preview + "Copiar para Google Docs" payload. */
export function renderSqlDocFragment(doc: SqlDocument, style: StyleConfig, opts: SqlDocOptions = DEFAULT_SQL_DOC_OPTIONS): string {
  return `<div style="font-family:'${style.bodyFont}',sans-serif;">${docHtml(doc, "inline", style, opts)}</div>`;
}

/** Full, self-contained `.html` page. */
export function renderSqlDocStandaloneHtml(doc: SqlDocument, style: StyleConfig, opts: SqlDocOptions = DEFAULT_SQL_DOC_OPTIONS): string {
  const toc = doc.entries.map((e, i) => `<a href="#${esc(entryAnchor(e, i))}">${esc(entryHeading(e))}</a>`).join("");
  const fontFamilies = [...new Set([style.titleFont, style.bodyFont])].filter((f) => !/arial|times|calibri/i.test(f));
  const fontLink = fontFamilies.length
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontFamilies.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&")}&display=swap">`
    : "";
  const fontOverride = `:root{--rb-font-family:'${style.bodyFont}',"Segoe UI",system-ui,sans-serif;} .doc h1{font-family:'${style.titleFont}',sans-serif;} .etapa pre{white-space:pre-wrap;}`;
  const docKey = `sql-${doc.entries.map((e) => e.code || e.id).join("-").slice(0, 80)}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)}</title>
${fontLink}
<style>${RB33_CSS}
${fontOverride}
${EDITOR_EDIT_CSS}</style>
</head>
<body data-doc="${esc(docKey)}">
<header class="topbar">
  <div class="brand"><div class="brand-text"><h1>${esc(doc.title)}<span class="brand-thin">${esc(doc.subtitle)}</span></h1><span class="sub">Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</span></div></div>
  <div class="topbar-actions">
    ${editorActionsHtml({ btn: "btn", primary: "btn-primary", status: "notes-saved" })}
  </div>
</header>
<div class="layout">
  <aside class="sidebar"><nav class="toc">${toc}</nav></aside>
  <main class="doc" data-editable-root spellcheck="true"><div class="process-block">${docHtml(doc, "class", style, opts)}</div></main>
</div>
<script>${EDITOR_SCRIPT}</script>
</body>
</html>`;
}
