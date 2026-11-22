import { documentToMarkdown } from "./export-markdown";
import { rb33ToMarkdown } from "./export-rb33-markdown";
import { renderDocumentHtml } from "./render-html";
import { renderRb33Fragment, renderRb33StandaloneHtml } from "./render-rb33-html";
import { DEFAULT_DOC_OPTIONS, type DocOptions, type DocumentacaoPS, type StyleConfig } from "./types";

/** One entry point per output, picking the renderer by `opts.modelo`, so the preview, the
 *  downloads and the clipboard copy can never disagree on which model they show. */

export function docPreviewHtml(doc: DocumentacaoPS, style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS): string {
  return opts.modelo === "resumido" ? renderRb33Fragment(doc, style, opts) : renderDocumentHtml(doc, style, opts);
}

export function docMarkdown(doc: DocumentacaoPS, style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS): string {
  return opts.modelo === "resumido" ? rb33ToMarkdown(doc, opts) : documentToMarkdown(doc, style, opts);
}

/** The `docx` library is only downloaded when the user actually exports. */
export async function docDocx(docs: DocumentacaoPS[], style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS): Promise<Blob> {
  if (opts.modelo === "resumido") {
    const { buildRb33Docx } = await import("./export-rb33-docx");
    return buildRb33Docx(docs, style, opts);
  }
  const { buildDocx } = await import("./export-docx");
  return buildDocx(docs[0], style, opts);
}

function escAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Standalone `.html` page. "resumido" gets the full RB-33 page (index, editable notes, print);
 *  "detalhado" wraps the existing inline-styled document in a plain page. */
export function docStandaloneHtml(docs: DocumentacaoPS[], style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS, pageTitle?: string): string {
  if (opts.modelo === "resumido") return renderRb33StandaloneHtml(docs, style, opts, pageTitle);
  const title = pageTitle ?? docs.map((d) => d.tituloPortal).join(" · ");
  const body = docs.map((d) => renderDocumentHtml(d, style, opts)).join(`<hr style="margin:48px 0;border:none;border-top:2px solid #ddd">`);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escAttr(title)}</title>
<style>body{margin:0;background:#fff;color:${style.bodyColor};font-family:'${style.bodyFont}',sans-serif;padding:24px 16px}main{max-width:960px;margin:0 auto}@media print{body{padding:0}}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}
