import type { Paragraph as ParagraphType, TextRun as TextRunType } from "docx";
import { buildTrilhaRow } from "./logic-trail-format";
import { logicColor } from "./logic-color";
import { DEFAULT_STYLE, type LogicTrailDoc, type StyleConfig } from "./types";

const hex = (color: string) => color.replace("#", "");

/** Builds the "Trilhas de lógica" .docx — same role as `buildDocx` for the full documentation, but
 *  as one card per trail (Início → Meio → Fim) instead of the etapa/passo/componente hierarchy.
 *  Imports `docx` lazily, like `buildDocx`, so the library is only downloaded when the user
 *  actually exports. Runs entirely in the browser via `Packer.toBlob`. */
export async function buildLogicTrailDocx(doc: LogicTrailDoc, style: StyleConfig = DEFAULT_STYLE): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs: ParagraphType[] = [];

  const run = (text: string, options: { bold?: boolean; color?: string } = {}) =>
    new TextRun({ text, font: style.bodyFont, color: hex(options.color ?? style.bodyColor), size: 22, bold: options.bold });

  paragraphs.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: `Trilhas de lógica — ${doc.tituloPortal}`, bold: true, font: style.titleFont, color: hex(style.titleColor), size: 52 })],
    })
  );

  if (doc.trilhas.length === 0) {
    paragraphs.push(new Paragraph({ children: [run("Nenhuma lógica de exibição/ação ou origem de dados identificada.")] }));
  }

  const heading = (text: string) =>
    new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text, bold: true, font: style.bodyFont, color: hex(style.stageColor), size: 28 })] });

  const kv = (label: string, value: string, indent = 0) =>
    new Paragraph({
      spacing: { after: 60 },
      bullet: { level: indent },
      children: [run(`${label}: `), run(value, { bold: true, color: logicColor(value, style) ?? style.bodyColor })],
    });

  const bullet = (children: TextRunType[], indent = 0) => new Paragraph({ spacing: { after: 60 }, bullet: { level: indent }, children });

  for (const entry of doc.trilhas) {
    const row = buildTrilhaRow(entry);
    paragraphs.push(heading(row.tipoLabel));
    paragraphs.push(kv("Início", row.breadcrumb));
    if (row.acao !== undefined) {
      paragraphs.push(kv("Ação", row.acao));
      paragraphs.push(kv("Condição", row.condicao ?? "não identificada"));
      for (const r of row.regras ?? []) {
        const children = [run(`${r.campo} → `), run(r.regra, { bold: true })];
        if (r.valor !== undefined) children.push(run(" → "), run(r.valor, { bold: true }));
        paragraphs.push(bullet(children, 1));
      }
    } else {
      for (const l of row.meioLines) paragraphs.push(kv(l.label, l.value));
      for (const p of row.parametros ?? []) paragraphs.push(p.detalhe ? kv(p.nome, p.detalhe, 1) : bullet([run(p.nome)], 1));
    }
    paragraphs.push(kv("Fim", row.elemento));
  }

  const document = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(document);
}
