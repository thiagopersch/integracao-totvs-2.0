import { escapeHtml } from "./interpolate";
import { resolveLinkHref } from "./app-link";
import type {
  AlignItems,
  Block,
  BlockAlign,
  BlockTree,
  ButtonBlock,
  ContainerBlock,
  DividerBlock,
  FlexDirection,
  ImageBlock,
  JustifyContent,
  LeafBlock,
  RowBlock,
  TableBlock,
  TextBlock,
} from "./block-types";

/**
 * Block tree → email-safe HTML: table-based layout with inline styles only, since the output goes
 * to arbitrary email clients (Gmail/Outlook ignore stylesheets, classes and most flexbox CSS).
 * `{{variables}}` are left in place and filled later by `interpolate` (which escapes the values).
 */

export interface RenderOptions {
  /** Prefix for relative image/link URLs (e.g. uploads served from /storage/...) — emails need absolute URLs. */
  baseUrl?: string;
  /** Max width (px) of the email body — MessageTemplate.emailWidth. */
  emailWidth?: number;
}

/** 600px is the classic width every email client handles; wider bodies suit many-column reports. */
export const DEFAULT_EMAIL_WIDTH = 600;
export const EMAIL_WIDTH_PRESETS = [600, 700, 800, 900];
/** Smallest useful body — no maximum: on phones the body is fluid anyway (see EMAIL_RESPONSIVE_CSS). */
export const MIN_EMAIL_WIDTH = 320;

const emailWidthOf = (width?: number) => Math.round(Math.max(width || DEFAULT_EMAIL_WIDTH, MIN_EMAIL_WIDTH));

/** Width of a table/box: the `width` attribute (px only — Outlook reads it) + the inline style. */
function boxWidth(width: number | undefined, unit: "px" | "%" = "px") {
  if (!width) return { attr: ` width="100%"`, style: "" };
  const value = unit === "%" ? `${Math.min(width, 100)}%` : `${Math.round(width)}px`;
  return { attr: ` width="${unit === "%" ? value : Math.round(width)}"`, style: `width:${value};max-width:100%;` };
}

const ALIGN: Record<BlockAlign, string> = { left: "left", center: "center", right: "right" };

/** Escapes a user-entered attribute/text value while keeping `{{tokens}}` intact. */
const attr = (value: string) => escapeHtml(value);

/** Only http(s)/mailto/tel URLs, relative paths and variable tokens are allowed in links/images. */
function safeUrl(url: string | undefined, options: RenderOptions): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  if (/^\{\{\s*\w+\s*\}\}/.test(value)) return attr(value);
  if (value.startsWith("/")) return attr(`${(options.baseUrl ?? "").replace(/\/$/, "")}${value}`);
  if (/^(https?:|mailto:|tel:)/i.test(value)) return attr(value);
  return "";
}

// Allowlist (not a blocklist of known-bad patterns, which `<svg/onload=…>` or an unquoted
// `href=javascript:` slipped through): only the tags/attributes the rich-text editor emits survive.
// Runs on the server (e-mail rendering) where there's no DOM for DOMPurify; the builder canvas also
// passes the result through DOMPurify in the browser.
const RICH_TEXT_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "del", "a", "ul", "ol", "li",
  "blockquote", "code", "pre", "span", "mark", "hr", "sub", "sup",
]);
const RICH_TEXT_ATTRS = new Set(["style", "href", "target", "rel", "class", "title"]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template|noscript|textarea|select)\b[\s\S]*?<\/\1\s*>/gi;

function sanitizeAttrs(tag: string, raw: string): string {
  const out: string[] = [];
  const attrPattern = /([^\s"'<>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = attrPattern.exec(raw))) {
    const name = m[1].toLowerCase();
    if (!RICH_TEXT_ATTRS.has(name)) continue;
    let value = (m[2] ?? "").replace(/^["']|["']$/g, "");
    value = value.replace(/&(#x?[0-9a-f]+|colon|tab|newline);?/gi, "");
    if (name === "href") {
      if (tag !== "a") continue;
      const v = value.trim();
      if (!/^(https?:|mailto:|tel:|#|\/|\{\{)/i.test(v)) continue;
    }
    if (name === "style" && /expression\s*\(|url\s*\(|javascript:|@import|behavior\s*:/i.test(value)) continue;
    out.push(`${name}="${value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`);
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

/** Keeps only editor-produced markup: unknown tags are removed (their text kept), unknown attributes dropped. */
export function sanitizeRichText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (full, rawTag: string, rest: string) => {
      const tag = rawTag.toLowerCase();
      if (!RICH_TEXT_TAGS.has(tag)) return "";
      if (full.startsWith("</")) return `</${tag}>`;
      return `<${tag}${sanitizeAttrs(tag, rest)}>`;
    })
    // A stray "<" that didn't form a tag (e.g. "<svg" without ">") must not become one later.
    .replace(/<(?![a-z/])/gi, "&lt;");
}

// Email-safe typography for every tag the rich-text editor (TipTap) can emit — the editor's
// prose classes don't exist in an email client, so it's inlined here.
const TEXT_TAG_STYLES: Record<string, string> = {
  h1: "font-size:28px;font-weight:700;line-height:1.3;margin:16px 0 8px;",
  h2: "font-size:22px;font-weight:700;line-height:1.3;margin:16px 0 8px;",
  h3: "font-size:18px;font-weight:700;line-height:1.3;margin:14px 0 6px;",
  p: "margin:0 0 12px;line-height:1.6;",
  ul: "margin:0 0 12px;padding-left:20px;",
  ol: "margin:0 0 12px;padding-left:20px;",
  li: "margin:0 0 4px;line-height:1.6;",
  blockquote: "margin:0 0 12px;padding-left:12px;border-left:3px solid #e2e8f0;color:#555555;",
  a: "color:#2563eb;text-decoration:underline;",
};

function applyEmailTypography(html: string): string {
  return Object.entries(TEXT_TAG_STYLES).reduce((result, [tag, css]) => {
    const openTag = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
    return result.replace(openTag, (_match, attrs: string | undefined) => {
      const rest = (attrs || "").replace(/\/\s*$/, "").trim();
      if (/style\s*=\s*"/.test(rest)) {
        return `<${tag} ${rest.replace(/style\s*=\s*"([^"]*)"/, (_m, existing: string) => `style="${css}${existing}"`)}>`;
      }
      return `<${tag}${rest ? ` ${rest}` : ""} style="${css}">`;
    });
  }, html);
}

function renderText(block: TextBlock): string {
  return `<td style="padding:8px 0;">${applyEmailTypography(sanitizeRichText(block.props.html))}</td>`;
}

function renderImage(block: ImageBlock, options: RenderOptions): string {
  const { src, alt, width, widthUnit = "px", align, borderRadius, href, linkType } = block.props;
  const url = safeUrl(src, options);
  if (!url) return `<td style="padding:8px 0;"></td>`;
  const widthAttr = width && widthUnit === "px" ? ` width="${Math.round(width)}"` : "";
  const widthStyle = width ? `width:${width}${widthUnit === "%" ? "%" : "px"};` : "";
  const img = `<img src="${url}" alt="${attr(alt)}"${widthAttr} style="display:inline-block;max-width:100%;height:auto;border:0;border-radius:${borderRadius}px;${widthStyle}">`;
  const link = safeUrl(resolveLinkHref(href, linkType), options);
  const content = link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${img}</a>` : img;
  return `<td style="padding:8px 0;text-align:${ALIGN[align]};">${content}</td>`;
}

function renderButton(block: ButtonBlock, options: RenderOptions): string {
  const { label, href, linkType, bgColor, textColor, radius, paddingY, paddingX, align } = block.props;
  const margin = align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0";
  const link = safeUrl(resolveLinkHref(href, linkType), options) || "#";
  return `<td style="padding:8px 0;text-align:${ALIGN[align]};"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:${margin};"><tr><td style="background-color:${attr(bgColor)};border-radius:${radius}px;"><a href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:${paddingY}px ${paddingX}px;color:${attr(textColor)};text-decoration:none;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${attr(label)}</a></td></tr></table></td>`;
}

function renderDivider(block: DividerBlock): string {
  const { color, thickness, marginY } = block.props;
  return `<td style="padding:0;"><hr style="border:none;border-top:${thickness}px solid ${attr(color)};margin:${marginY}px 0;"></td>`;
}

/**
 * Tables never break words: cells stay on one line (`wrapCells` allows wrapping between words) and
 * the table sits in a horizontal-scroll box, so a wide table keeps its columns aligned instead of
 * squeezing. On phones (EMAIL_RESPONSIVE_CSS) a table with a header turns each row into a card: the
 * first column is the title and every other cell shows its header as a label ("Horas ... 30h") —
 * the labels are hidden spans in the cell, the most portable technique (no ::before/attr()).
 */
function renderTable(block: TableBlock): string {
  const {
    cells,
    hasHeader,
    repeatRows = [],
    headerBgColor = "#f8fafc",
    borderColor = "#e2e8f0",
    width,
    widthUnit,
    fontSize = 14,
    columnWidths = [],
    mobileLayout = "cards",
    wrapCells = false,
  } = block.props;
  const size = boxWidth(width, widthUnit);
  const cards = hasHeader && mobileLayout === "cards";
  const labels = cards ? (cells[0] ?? []) : [];
  const colWidth = (c: number) => {
    const w = columnWidths[c];
    return w ? Math.min(Math.round(w), 100) : null;
  };
  const rows = cells
    .map((row, rowIndex) => {
      const header = hasHeader && rowIndex === 0;
      const tag = header ? "th" : "td";
      const cellsHtml = row.map((cell, c) => {
        const w = colWidth(c);
        const style = `border:1px solid ${attr(borderColor)};padding:8px;text-align:left;font-size:${fontSize}px;${
          wrapCells ? "" : "white-space:nowrap;"
        }${header ? `background-color:${attr(headerBgColor)};font-weight:600;` : ""}`;
        // Column widths go on the first row's cells — the most portable way across email clients.
        const widthAttr = rowIndex === 0 && w ? ` width="${w}%"` : "";
        const title = cards && !header && c === 0;
        const className = title ? ` class="mt-title"` : "";
        const label =
          cards && !header && c > 0 && labels[c]?.trim()
            ? `<span class="mt-label" style="display:none;mso-hide:all;">${attr(labels[c])}</span>`
            : "";
        return `<${tag}${widthAttr}${className} style="${style}">${label}${attr(cell)}</${tag}>`;
      });
      const html = `<tr${header && cards ? ` class="mt-head"` : ""}>${cellsHtml.join("")}</tr>`;
      return !header && repeatRows.includes(rowIndex) ? `<!--rowrepeat-->${html}<!--endrowrepeat-->` : html;
    })
    .join("");
  const classes = [cards && "mt-cards", cards && wrapCells && "mt-wrap", width && widthUnit !== "%" && "mt-fluid"].filter(Boolean).join(" ");
  const table = `<table role="presentation"${classes ? ` class="${classes}"` : ""}${size.attr} border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;${size.style}">${rows}</table>`;
  return `<td style="padding:8px 0;"><div class="mt-scroll" style="overflow-x:auto;max-width:100%;">${table}</div></td>`;
}

export function renderLeafBlock(block: LeafBlock, options: RenderOptions = {}): string {
  switch (block.type) {
    case "text":
      return renderText(block);
    case "image":
      return renderImage(block, options);
    case "button":
      return renderButton(block, options);
    case "divider":
      return renderDivider(block);
    case "table":
      return renderTable(block);
  }
}

const stack = (children: LeafBlock[], options: RenderOptions) =>
  `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">${children
    .map((c) => `<tr>${renderLeafBlock(c, options)}</tr>`)
    .join("")}</table>`;

const withCondition = (html: string, visibleIf?: string) =>
  visibleIf && /^\w+$/.test(visibleIf) ? `<!--cond:${visibleIf}-->${html}<!--endcond-->` : html;

function renderRow(block: RowBlock, options: RenderOptions): string {
  const { paddingY, paddingX, backgroundColor, visibleIf } = block.props;
  const columns = block.children
    .map(
      (column) =>
        `<td width="${column.props.widthPercent}%" style="vertical-align:top;padding:0 8px;">${stack(column.children, options)}</td>`
    )
    .join("");
  const html = `<tr><td style="padding:${paddingY}px ${paddingX}px;background-color:${attr(backgroundColor)};"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>${columns}</tr></table></td></tr>`;
  return withCondition(html, visibleIf);
}

// Email clients drop flex CSS, so the container's flex settings become their table equivalent.
const VALIGN: Record<AlignItems, string> = { "flex-start": "top", "flex-end": "bottom", center: "middle", stretch: "top" };
const TEXT_ALIGN: Record<AlignItems, string> = { "flex-start": "left", "flex-end": "right", center: "center", stretch: "left" };
const TABLE_ALIGN: Record<JustifyContent, string> = {
  "flex-start": "left",
  "flex-end": "right",
  center: "center",
  "space-between": "left",
};

function renderFlex(
  children: LeafBlock[],
  direction: FlexDirection,
  justify: JustifyContent,
  alignItems: AlignItems,
  gap: number,
  options: RenderOptions
): string {
  const ordered = direction.endsWith("reverse") ? [...children].reverse() : children;
  const mini = (child: LeafBlock, align?: string) =>
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0"${align ? ` align="${align}"` : ""}><tr>${renderLeafBlock(child, options)}</tr></table>`;

  if (direction.startsWith("column")) {
    const align = TEXT_ALIGN[alignItems];
    return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">${ordered
      .map(
        (child, i) =>
          `<tr><td style="text-align:${align};${i < ordered.length - 1 ? `padding-bottom:${gap}px;` : ""}">${mini(child, align)}</td></tr>`
      )
      .join("")}</table>`;
  }

  // space-between: spread cells across the full width instead of packing them.
  const spread = justify === "space-between";
  const cells = ordered
    .map((child, i) => {
      const cellAlign = spread ? (i === 0 ? "left" : i === ordered.length - 1 ? "right" : "center") : undefined;
      const pad = !spread && i < ordered.length - 1 ? `padding-right:${gap}px;` : "";
      return `<td style="vertical-align:${VALIGN[alignItems]};${pad}"${cellAlign ? ` align="${cellAlign}"` : ""}>${mini(child, cellAlign)}</td>`;
    })
    .join("");
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"${
    spread ? ' width="100%"' : ` align="${TABLE_ALIGN[justify]}"`
  }><tr>${cells}</tr></table>`;
}

function renderContainer(block: ContainerBlock, options: RenderOptions): string {
  const {
    marginY,
    marginX,
    paddingY,
    paddingX,
    backgroundColor,
    borderColor,
    borderRadius = 0,
    visibleIf,
    display = "block",
    flexDirection = "row",
    justifyContent = "flex-start",
    alignItems = "stretch",
    gap = 0,
    width,
    widthUnit,
    align = "center",
  } = block.props;
  const size = boxWidth(width, widthUnit);
  const inner =
    display === "flex"
      ? renderFlex(block.children, flexDirection, justifyContent, alignItems, gap, options)
      : stack(block.children, options);
  const border = borderColor && borderColor !== "transparent" ? `border:1px solid ${attr(borderColor)};` : "";
  // `margin` is unreliable on table cells in email clients, so the outer cell's padding simulates it.
  const html = `<tr><td align="${ALIGN[align]}" style="padding:${marginY}px ${marginX}px;"><table role="presentation"${width && widthUnit !== "%" ? ` class="mt-fluid"` : ""}${size.attr} border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;${size.style}"><tr><td style="padding:${paddingY}px ${paddingX}px;background-color:${attr(backgroundColor)};border-radius:${borderRadius}px;${border}">${inner}</td></tr></table></td></tr>`;
  const conditional = withCondition(html, visibleIf);
  return block.props.repeatPerClient ? `<!--repeat-->${conditional}<!--endrepeat-->` : conditional;
}

function renderTopLevel(block: Block, options: RenderOptions): string {
  if (block.type === "row") return renderRow(block, options);
  if (block.type === "container") return renderContainer(block, options);
  return `<tr>${renderLeafBlock(block, options)}</tr>`;
}

/** Renders the template body (a centered table, `emailWidth` px max) — still containing `{{variables}}`. */
export function renderBlockTree(tree: BlockTree, options: RenderOptions = {}): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:${emailWidthOf(options.emailWidth)}px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;">${tree
    .map((b) => renderTopLevel(b, options))
    .join("")}</table>`;
}

/**
 * Phone layout (clients that honor <style> media queries — Apple Mail, iOS/Android Gmail with Google
 * accounts, Outlook mobile…): the body becomes fluid with smaller paddings, fixed-width boxes shrink
 * to the screen and tables with a header turn into one card per row (see renderTable). `!important`
 * is needed to win over the inline styles. Clients without media queries keep the desktop layout,
 * where wide tables scroll sideways instead of squeezing.
 */
export const EMAIL_RESPONSIVE_CSS = `@media only screen and (max-width:600px){
.mt-outer{padding:12px 6px !important}
.mt-pad{padding:16px !important}
.mt-fluid{width:100% !important;max-width:100% !important}
.mt-scroll{overflow:visible !important}
table.mt-cards,table.mt-cards tbody,table.mt-cards tr,table.mt-cards td{display:block !important;width:100% !important;box-sizing:border-box !important}
table.mt-cards tr.mt-head{display:none !important}
table.mt-cards tr{border:1px solid #e2e8f0 !important;border-radius:8px !important;margin:0 0 12px 0 !important;overflow:hidden !important}
table.mt-cards td{border:0 !important;border-top:1px solid #eef2f6 !important;padding:9px 12px !important;text-align:right !important;white-space:nowrap !important;overflow:hidden !important}
table.mt-cards.mt-wrap td{white-space:normal !important}
table.mt-cards td.mt-title{border-top:0 !important;text-align:left !important;font-weight:700 !important;background-color:#f8fafc !important}
table.mt-cards .mt-label{display:inline !important;float:left !important;margin-right:16px !important;font-weight:600 !important;color:#475569 !important;text-align:left !important}
}`;

/** Full HTML document sent by email (light background, centered body). */
export function wrapEmailDocument(bodyHtml: string, subject = "", emailWidth?: number): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(
    subject
  )}</title><style>${EMAIL_RESPONSIVE_CSS}</style></head><body style="margin:0;padding:0;background-color:#f4f4f5;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td class="mt-outer" align="center" style="padding:24px 12px;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:${emailWidthOf(emailWidth)}px;background-color:#ffffff;border-radius:8px;"><tr><td class="mt-pad" style="padding:24px;">${bodyHtml}</td></tr></table></td></tr></table></body></html>`;
}

/** Preview document for the builder iframes: same as the email, with link clicks disabled. */
export function wrapPreviewDocument(bodyHtml: string, emailWidth?: number): string {
  return wrapEmailDocument(bodyHtml, "", emailWidth).replace(
    "</body>",
    `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a"):null;if(a){e.preventDefault();}},true);</script></body>`
  );
}
