import { buildTrilhaRow } from "./logic-trail-format";
import { logicColor } from "./logic-color";
import { DEFAULT_STYLE, type LogicTrailDoc, type StyleConfig } from "./types";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function logicStyleAttr(value: string, style: StyleConfig): string {
  const color = logicColor(value, style);
  return color ? ` style="color:${color}"` : "";
}

/** Renders the "Trilhas de lógica" documentation as styled HTML — same role as `renderDocumentHtml`
 *  for the full documentation: single source of truth for the on-screen preview and the
 *  `text/html` clipboard payload used by "Copiar para Google Docs". Each trail is its own card:
 *  Início (breadcrumb) → Meio (regras+condição, ou a fonte de dados) → Fim (elemento). */
export function renderLogicTrailHtml(doc: LogicTrailDoc, style: StyleConfig = DEFAULT_STYLE): string {
  const titleStyle = `font-family:'${style.titleFont}',sans-serif;color:${style.titleColor};font-size:26pt;font-weight:900;`;
  const cardTitleStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:13pt;font-weight:700;margin-top:18pt;`;
  const bodyStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.bodyColor};font-size:11pt;line-height:1.5;`;
  const breadcrumbStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.stageColor};font-size:10pt;font-weight:600;`;
  const ulStyle = `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`;
  const cardStyle = `border:1px solid rgba(127,127,127,0.25);border-radius:8px;padding:12px 16px;margin:10px 0;`;

  const kv = (label: string, value: string) => `<li style="${bodyStyle}">${esc(label)}: <strong${logicStyleAttr(value, style)}>${esc(value)}</strong></li>`;

  const parts: string[] = [`<h1 style="${titleStyle}">Trilhas de lógica — ${esc(doc.tituloPortal)}</h1>`];

  if (doc.trilhas.length === 0) {
    parts.push(`<p style="${bodyStyle}">Nenhuma lógica de exibição/ação ou origem de dados identificada.</p>`);
    return parts.join("");
  }

  for (const entry of doc.trilhas) {
    const row = buildTrilhaRow(entry);
    const items: string[] = [];
    items.push(`<li style="${breadcrumbStyle}">${esc("Início")}: ${esc(row.breadcrumb)}</li>`);
    if (row.acao !== undefined) {
      items.push(kv("Ação", row.acao));
      items.push(kv("Condição", row.condicao ?? "não identificada"));
      const regrasHtml = (row.regras ?? [])
        .map((r) => `<li style="${bodyStyle}">${esc(r.campo)} → <strong>${esc(r.regra)}</strong>${r.valor !== undefined ? ` → <strong>${esc(r.valor)}</strong>` : ""}</li>`)
        .join("");
      if (regrasHtml) items.push(`<li style="${bodyStyle}">${esc("Regras")}:<ul style="${ulStyle}">${regrasHtml}</ul></li>`);
    } else {
      for (const l of row.meioLines) items.push(kv(l.label, l.value));
      if (row.parametros && row.parametros.length > 0) {
        const paramsHtml = row.parametros.map((p) => (p.detalhe ? kv(p.nome, p.detalhe) : `<li style="${bodyStyle}">${esc(p.nome)}</li>`)).join("");
        items.push(`<li style="${bodyStyle}">${esc("Parâmetros")}:<ul style="${ulStyle}">${paramsHtml}</ul></li>`);
      }
    }
    items.push(kv("Fim", row.elemento));

    parts.push(
      `<div style="${cardStyle}"><h3 style="${cardTitleStyle}">${esc(row.tipoLabel)}</h3><ul style="${ulStyle}">${items.join("")}</ul></div>`
    );
  }

  return parts.join("");
}
