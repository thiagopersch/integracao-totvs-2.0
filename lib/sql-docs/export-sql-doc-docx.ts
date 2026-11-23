import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { StyleConfig } from "@/lib/ps-docs/types";
import { DEFAULT_SQL_DOC_OPTIONS, entryHeading, type SqlDocOptions, type SqlDocument } from "./types";

/** .docx of the "Mapeamento de consultas" document — same look as the RB-33 .docx
 *  (`lib/ps-docs/export-rb33-docx.ts`): title, mono subtitle, one H2 per query with bulleted rules. */

const hex = (color: string) => color.replace("#", "");
const TEAL_DEEP = "004f4f";
const MUTED = "505353";
const BORDER = "c5c7c6";
const HEADER_FILL = "eff1f0";

export async function buildSqlDocDocx(doc: SqlDocument, style: StyleConfig, opts: SqlDocOptions = DEFAULT_SQL_DOC_OPTIONS): Promise<Blob> {
  const font = style.bodyFont;
  const run = (text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number; mono?: boolean; caps?: boolean } = {}) =>
    new TextRun({ text, bold: o.bold, italics: o.italics, allCaps: o.caps, font: o.mono ? "Consolas" : font, color: o.color ?? hex(style.bodyColor), size: o.size ?? 22 });

  const label = (text: string) =>
    new Paragraph({
      spacing: { before: 220, after: 100 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: "005c5c", space: 6 } },
      children: [run(text, { bold: true, caps: true, color: TEAL_DEEP, size: 20 })],
    });
  const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [run(text)] });
  const borders = Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((k) => [k, { style: BorderStyle.SINGLE, size: 4, color: BORDER }]));
  const widths = [30, 45, 25];
  const cell = (children: TextRun[], fill: string | undefined, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children })],
    });
  const table = (head: string[], rows: [string, string, string][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({ tableHeader: true, children: head.map((h, i) => cell([run(h, { bold: true, caps: true, size: 17, color: "2e3131" })], HEADER_FILL, widths[i])) }),
        ...rows.map(
          (r, idx) =>
            new TableRow({
              children: [
                cell([run(r[0], { mono: true, size: 17, color: TEAL_DEEP })], idx % 2 ? "f8faf9" : undefined, widths[0]),
                cell([run(r[1], { size: 19 })], idx % 2 ? "f8faf9" : undefined, widths[1]),
                cell([run(r[2], { size: 19 })], idx % 2 ? "f8faf9" : undefined, widths[2]),
              ],
            })
        ),
      ],
    });

  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 60 }, children: [new TextRun({ text: doc.title, bold: true, font: style.titleFont, color: hex(style.titleColor), size: 48 })] }));
  if (doc.subtitle) out.push(new Paragraph({ spacing: { after: 300 }, children: [run(doc.subtitle, { mono: true, size: 18, color: MUTED })] }));

  for (const e of doc.entries) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 100 }, children: [new TextRun({ text: entryHeading(e), bold: true, font, color: hex(style.stageColor), size: 30 })] }));
    if (opts.includeSummary && e.summary) out.push(new Paragraph({ spacing: { after: 80 }, children: [run(e.summary, { italics: true, color: MUTED, size: 21 })] }));
    if (e.rules.length === 0) out.push(new Paragraph({ children: [run("Nenhuma regra registrada.", { italics: true, color: MUTED })] }));
    e.rules.forEach((r) => out.push(bullet(r)));

    if (opts.includeTables) {
      if (e.parameters.length) {
        out.push(label("Parâmetros"));
        e.parameters.forEach((p) => out.push(bullet(p)));
      }
      if (e.tables.length) {
        out.push(label("Tabelas utilizadas"));
        out.push(table(["Tabela", "Descrição", "Papel na consulta"], e.tables.map((t) => [`${t.name}${t.alias ? ` (${t.alias})` : ""}`, t.description ?? "—", t.role])));
      }
      if (e.fields.length) {
        out.push(label("Campos utilizados"));
        out.push(table(["Campo", "Descrição", "Uso"], e.fields.map((f) => [f.table ? `${f.table}.${f.column}` : f.column, f.description ?? "—", f.usage])));
      }
    }
    if (opts.includeSql && e.sql.trim()) {
      out.push(label("Sentença SQL"));
      const lines = e.sql.trim().split("\n");
      out.push(
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: "auto" },
          spacing: { after: 120 },
          children: lines.map((l, i) => new TextRun({ text: l, break: i ? 1 : 0, font: "Consolas", size: 17, color: hex(style.bodyColor) })),
        })
      );
    }
  }

  const document = new Document({ styles: { default: { document: { run: { font } } } }, sections: [{ children: out }] });
  return Packer.toBlob(document);
}
