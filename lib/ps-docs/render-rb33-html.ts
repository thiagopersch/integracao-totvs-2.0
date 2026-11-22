import { RB33_SECTION, buildRb33Doc, type Rb33AcaoLinha, type Rb33Doc, type Rb33Etapa, type Rb33Item } from "./rb33-format";
import { RB33_CSS } from "./rb33-styles";
import { DEFAULT_DOC_OPTIONS, type DocOptions, type DocumentacaoPS, type StyleConfig } from "./types";

/** HTML for the "Resumido (RB-33)" model. One markup tree, two skins:
 *  - "inline": every style inline — the on-screen preview and the "Copiar para Google Docs"
 *    payload (a pasted fragment keeps no stylesheet).
 *  - "class": the RB-33 reference classes (`rb33-styles.ts`) — the standalone `.html` export,
 *    which also gets a sidebar index, editable notes and print CSS. */

type Skin = "inline" | "class";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TEAL_DEEP = "#004f4f";
const TEAL_BORDER = "#005c5c";
const TEAL_SOFT = "#e2fffe";
const MUTED = "#505353";
const BORDER = "#e1e3e2";
const REQUIRED = "#7e0007";

function inlineStyles(style: StyleConfig) {
  const font = `font-family:'${style.bodyFont}',sans-serif;`;
  return {
    h1: `font-family:'${style.titleFont}',sans-serif;color:${style.titleColor};font-size:24pt;font-weight:700;margin:0 0 4pt;`,
    subtitle: `font-family:monospace;color:${MUTED};font-size:9.5pt;margin:0 0 18pt;`,
    h2: `${font}color:${style.stageColor};font-size:15pt;font-weight:600;margin:26pt 0 2pt;`,
    internalId: `font-family:monospace;color:${MUTED};font-size:9pt;margin:0 0 12pt;`,
    label: `${font}color:${TEAL_DEEP};font-size:10.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-left:3px solid ${TEAL_BORDER};padding-left:8px;margin:16pt 0 6pt;`,
    body: `${font}color:${style.bodyColor};font-size:11pt;line-height:1.55;margin:0 0 4pt;white-space:pre-line;`,
    fonte: `font-family:monospace;color:${MUTED};font-size:9pt;margin:0 0 8pt;`,
    stepName: `${font}color:${style.bodyColor};font-size:11.5pt;font-weight:700;margin:10pt 0 4pt;`,
    ul: `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`,
    li: `${font}color:${style.bodyColor};font-size:11pt;line-height:1.55;margin-bottom:4px;`,
    tag: `display:inline-block;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${TEAL_DEEP};background:${TEAL_SOFT};padding:1px 6px;border-radius:999px;margin-right:6px;`,
    required: `color:${REQUIRED};font-weight:700;`,
    cond: `font-style:italic;color:${MUTED};`,
    note: `display:block;font-size:9.5pt;color:${MUTED};line-height:1.45;margin:1px 0;`,
    code: `display:block;font-family:monospace;font-size:9pt;white-space:pre-wrap;background:#eff1f0;padding:6px 8px;margin:2px 0 6px;`,
    fb: `${font}color:${style.bodyColor};font-size:11pt;line-height:1.55;margin:0 0 6pt;white-space:pre-line;`,
    fbLabel: `font-weight:700;`,
    btnTitle: `${font}color:${style.bodyColor};font-size:11pt;font-weight:600;margin:12pt 0 4pt;`,
    btnCond: `font-style:italic;color:${MUTED};font-size:9.5pt;font-weight:400;`,
    table: `border-collapse:collapse;width:100%;margin:0 0 8pt;${font}font-size:10pt;`,
    th: `border:1px solid ${BORDER};background:#eff1f0;color:#2e3131;text-align:left;padding:6px 8px;font-size:9pt;text-transform:uppercase;letter-spacing:.04em;`,
    td: `border:1px solid ${BORDER};padding:6px 8px;vertical-align:top;color:${style.bodyColor};white-space:pre-line;`,
    tdMuted: `border:1px solid ${BORDER};padding:6px 8px;vertical-align:top;color:${MUTED};`,
    queryCode: `font-family:monospace;font-size:9pt;color:${TEAL_DEEP};`,
    muted: `color:${MUTED};font-style:italic;${font}font-size:11pt;`,
  };
}

type InlineKey = keyof ReturnType<typeof inlineStyles>;

/** Maps each role to the RB-33 class for the "class" skin. */
const CLASS_OF: Partial<Record<InlineKey, string>> = {
  subtitle: "subtitle",
  internalId: "internal-id",
  label: "section-label",
  body: "section-body",
  fonte: "fonte-dados",
  stepName: "step-name",
  tag: "tag",
  required: "field-required",
  cond: "field-cond",
  note: "field-note",
  code: "script-code",
  fb: "feedback-item",
  fbLabel: "fb-label",
  btnTitle: "action-btn-title",
  btnCond: "action-cond",
  table: "actions-table",
  tdMuted: "muted-cell",
  queryCode: "query-code",
  muted: "section-body hint",
};

interface RenderCtx {
  skin: Skin;
  a: (key: InlineKey, extra?: string) => string;
}

function makeCtx(skin: Skin, style: StyleConfig): RenderCtx {
  const s = inlineStyles(style);
  return {
    skin,
    a: (key, extra) => {
      if (skin === "inline") return ` style="${s[key]}"`;
      const cls = [CLASS_OF[key], extra].filter(Boolean).join(" ");
      return cls ? ` class="${cls}"` : "";
    },
  };
}

function itemHtml(item: Rb33Item, c: RenderCtx): string {
  const tag = item.tag ? `<span${c.a("tag")}>${esc(item.tag)}</span>` : "";
  // The class skin adds the " *" via CSS (`.field-required::after`); inline needs it in the text.
  const nome = item.obrigatorio
    ? c.skin === "class"
      ? `<span class="field-required">${esc(item.nome)}</span>`
      : `<strong>${esc(item.nome)}</strong><span${c.a("required")}> *</span>`
    : c.skin === "inline"
      ? `<strong>${esc(item.nome)}</strong>`
      : `<span>${esc(item.nome)}</span>`;
  const cond = item.cond ? `<span${c.a("cond")}> — ${esc(item.cond)}</span>` : "";
  const notas = item.notas
    .map((n) => `<span${c.a("note")}>${esc(n.texto)}</span>${n.codigo ? `<code${c.a("code")}>${esc(n.codigo)}</code>` : ""}`)
    .join("");
  return `<li${c.skin === "inline" ? c.a("li") : ""}>${tag}${nome}${cond}${notas}</li>`;
}

function acaoRowHtml(l: Rb33AcaoLinha, c: RenderCtx): string {
  const td = c.skin === "inline" ? c.a("td") : "";
  const desc = [l.titulo ? `<b>${esc(l.titulo)}</b>` : "", l.descricao ? esc(l.descricao) : "", l.queryCode ? `<span${c.a("queryCode")}>(${esc(l.queryCode)})</span>` : ""].filter(Boolean).join(" ");
  const logica = l.logica ? `<td${td}>${esc(l.logica)}</td>` : `<td${c.a("tdMuted")}>—</td>`;
  return `<tr><td${td}>${esc(l.tipo)}</td><td${td}>${desc}</td>${logica}</tr>`;
}

function etapaHtml(e: Rb33Etapa, c: RenderCtx, docKey: string): string {
  const editable = (field: string, placeholder: string, text: string) =>
    c.skin === "class"
      ? `<div class="editable section-body" contenteditable="true" spellcheck="true" data-placeholder="${esc(placeholder)}" data-key="${esc(`${docKey}:${e.anchor}:${field}`)}">${esc(text)}</div>`
      : `<p${c.a("body")}>${esc(text)}</p>`;

  const passos = e.passos
    .map((p) => {
      const fonte = p.fonteDados ? `<div${c.a("fonte")}>Fonte de dados do passo: ${esc(p.fonteDados)}</div>` : "";
      const itens = p.itens.length > 0 ? `<ul${c.skin === "inline" ? c.a("ul") : ""}>${p.itens.map((i) => itemHtml(i, c)).join("")}</ul>` : `<p${c.a("muted")}>Nenhum campo neste passo.</p>`;
      const name = `<div${c.a("stepName")}>Passo: ${esc(p.nome)}</div>`;
      return c.skin === "class" ? `<div class="step-block">${name}${fonte}${itens}</div>` : `${name}${fonte}${itens}`;
    })
    .join("");

  const feedbacks =
    e.feedbacks.length > 0
      ? e.feedbacks.map((f) => `<p${c.a("fb")}><span${c.a("fbLabel")}>${esc(f.rotulo)}</span>${esc(f.texto)}</p>`).join("")
      : `<p${c.a("muted")}>Nenhum feedback configurado.</p>`;

  const head = `<thead><tr>${RB33_SECTION.colunas.map((h) => `<th${c.skin === "inline" ? c.a("th") : ""}>${h}</th>`).join("")}</tr></thead>`;
  const botoes =
    e.botoes.length > 0
      ? e.botoes
          .map((b) => {
            const title = `<div${c.a("btnTitle")}>${esc(b.titulo)}${b.cond ? `<span${c.a("btnCond")}> — botão ${esc(b.cond)}</span>` : ""}</div>`;
            const table = `<table${c.a("table")}>${head}<tbody>${b.linhas.map((l) => acaoRowHtml(l, c)).join("")}</tbody></table>`;
            return c.skin === "class" ? `<li>${title}${table}</li>` : `${title}${table}`;
          })
          .join("")
      : "";
  const acoesBody = botoes ? (c.skin === "class" ? `<ul class="actions-list">${botoes}</ul>` : botoes) : `<p${c.a("muted")}>${RB33_SECTION.semAcoes}</p>`;

  const acoesLabel =
    c.skin === "class"
      ? `<div class="section-label">${RB33_SECTION.acoes}<span class="auto-flag">— ${esc(RB33_SECTION.acoesHint)}</span></div>`
      : `<p${c.a("label")}>${RB33_SECTION.acoes}</p>`;

  const label = (t: string) => (c.skin === "class" ? `<div class="section-label">${t}</div>` : `<p${c.a("label")}>${t}</p>`);
  const h2 = c.skin === "inline" ? `<h2${c.a("h2")}>Etapa: ${esc(e.nome)}</h2>` : `<h2>Etapa: ${esc(e.nome)}</h2>`;
  const idLinha = e.idLinha ? `<div${c.a("internalId")}>${esc(e.idLinha)}</div>` : "";
  const fonte = e.fonteDados ? `<div${c.a("fonte")}>Fonte de dados da etapa: ${esc(e.fonteDados)}</div>` : "";
  const notas = c.skin === "class" ? `${label(`${RB33_SECTION.notas} <span class="auto-flag">(editável)</span>`)}${editable("notas", "Anote aqui observações, pendências ou decisões sobre esta etapa…", "")}` : "";

  const inner = [
    h2,
    idLinha,
    fonte,
    label(RB33_SECTION.logica),
    editable("logica", "Descreva a condição que libera esta etapa para o candidato…", e.logica.join("\n")),
    label(RB33_SECTION.descricao),
    editable("descricao", "Resuma o que o candidato encontra nesta etapa…", e.descricao),
    label(RB33_SECTION.passos),
    c.skin === "class" ? `<div class="section-body">${passos}</div>` : passos,
    label(RB33_SECTION.feedbacks),
    c.skin === "class" ? `<div class="section-body">${feedbacks}</div>` : feedbacks,
    acoesLabel,
    acoesBody,
    notas,
  ].join("");
  return c.skin === "class" ? `<section class="etapa" id="${esc(`${docKey}-${e.anchor}`)}">${inner}</section>` : inner;
}

function docHtml(d: Rb33Doc, c: RenderCtx, docKey: string): string {
  const h1 = c.skin === "inline" ? `<h1${c.a("h1")}>${esc(d.titulo)}</h1>` : `<h1>${esc(d.titulo)}</h1>`;
  const sub = d.subtitulo ? `<div${c.a("subtitle")}>${esc(d.subtitulo)}</div>` : "";
  const etapas = d.etapas.length > 0 ? d.etapas.map((e) => etapaHtml(e, c, docKey)).join("") : `<p${c.a("muted")}>Nenhuma etapa ativa encontrada.</p>`;
  return `${h1}${sub}${etapas}`;
}

/** Preview + Google Docs fragment of one process. */
export function renderRb33Fragment(doc: DocumentacaoPS, style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS): string {
  return `<div style="font-family:'${style.bodyFont}',sans-serif;">${docHtml(buildRb33Doc(doc, opts), makeCtx("inline", style), "doc")}</div>`;
}

const STANDALONE_SCRIPT = `
(function () {
  var KEY = "rb33-notes:" + (document.body.getAttribute("data-doc") || location.pathname);
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} }
  var saved = load();
  var fields = document.querySelectorAll(".editable[data-key]");
  fields.forEach(function (el) {
    var k = el.getAttribute("data-key");
    if (Object.prototype.hasOwnProperty.call(saved, k)) el.innerText = saved[k];
    el.addEventListener("input", function () { var all = load(); all[k] = el.innerText; save(all); });
  });

  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  function spy() {
    var current = 0;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < 140) current = i; });
    links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();

  var btnPrint = document.getElementById("btn-print");
  if (btnPrint) btnPrint.addEventListener("click", function () { window.print(); });
  var btnSave = document.getElementById("btn-save");
  if (btnSave) btnSave.addEventListener("click", function () {
    // Bakes the current edits into the markup so the downloaded copy carries them without storage.
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll(".toc a.active").forEach(function (a) { a.classList.remove("active"); });
    var html = "<!DOCTYPE html>\\n" + clone.outerHTML;
    var blob = new Blob([html], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (document.title || "documentacao").replace(/[^\\w\\-]+/g, "_") + ".html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
})();
`;

/** Full, self-contained `.html` page for one process or a whole portal (several processes, the
 *  index grouped by process). */
export function renderRb33StandaloneHtml(docs: DocumentacaoPS[], style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS, pageTitle?: string): string {
  const c = makeCtx("class", style);
  const built = docs.map((d) => ({ src: d, rb: buildRb33Doc(d, opts), key: `ps${d.idPs}` }));
  const title = pageTitle ?? (built.length === 1 ? `${built[0].rb.titulo} — Documentação técnica` : "Documentação técnica");

  const toc = built
    .map(({ rb, key }) => {
      const group = built.length > 1 ? `<div class="toc-group">${esc(rb.titulo)}</div>` : "";
      return group + rb.etapas.map((e) => `<a href="#${esc(`${key}-${e.anchor}`)}">${esc(e.nome)}</a>`).join("");
    })
    .join("");

  const body = built.map(({ rb, key }) => `<div class="process-block">${docHtml(rb, c, key)}</div>`).join("");
  const fontFamilies = [...new Set([style.titleFont, style.bodyFont])].filter((f) => !/arial|times|calibri/i.test(f));
  const fontLink = fontFamilies.length
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fontFamilies.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join("&")}&display=swap">`
    : "";
  const fontOverride = `:root{--rb-font-family:'${style.bodyFont}',"Segoe UI",system-ui,sans-serif;} .doc h1{font-family:'${style.titleFont}',sans-serif;}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${fontLink}
<style>${RB33_CSS}
${fontOverride}</style>
</head>
<body data-doc="${esc(built.map((b) => b.key).join("-"))}">
<header class="topbar">
  <div class="brand"><div class="brand-text"><h1>${esc(built.length === 1 ? built[0].rb.titulo : "Documentação técnica")}<span class="brand-thin">Documentação técnica</span></h1><span class="sub">Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</span></div></div>
  <div class="topbar-actions">
    <span class="notes-saved">Lógica, descrição e notas são editáveis — salvas neste navegador.</span>
    <button type="button" class="btn" id="btn-print">Imprimir / PDF</button>
    <button type="button" class="btn btn-primary" id="btn-save">Baixar HTML com edições</button>
  </div>
</header>
<div class="layout">
  <aside class="sidebar"><nav class="toc">${toc}</nav></aside>
  <main class="doc">${body}</main>
</div>
<script>${STANDALONE_SCRIPT}</script>
</body>
</html>`;
}
