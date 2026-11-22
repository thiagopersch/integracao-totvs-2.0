import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { RB33_SECTION, buildRb33Doc, isGrupoOculto, type Rb33Doc, type Rb33Etapa, type Rb33Item } from "./rb33-format";
import { DEFAULT_DOC_OPTIONS, type DocOptions, type DocumentacaoPS, type StyleConfig } from "./types";

/** .docx for the "Resumido (RB-33)" model — same structure as the RB-33 HTML: numbered section
 *  labels, one bullet per field with its notes as indented lines, one table per button. */

const hex = (color: string) => color.replace("#", "");
const TEAL_DEEP = "004f4f";
const TEAL_SOFT = "e2fffe";
const MUTED = "505353";
const BORDER = "c5c7c6";
const HEADER_FILL = "eff1f0";
const REQUIRED = "7e0007";
const AMBER_BG = "ffede2";
const AMBER_TAG = "ffdcc2";
const AMBER_TEXT = "904d00";
const AMBER_BORDER = "ffba3d";

function docChildren(d: Rb33Doc, style: StyleConfig): (Paragraph | Table)[] {
  const font = style.bodyFont;
  const run = (text: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number; mono?: boolean; shade?: string; caps?: boolean } = {}) =>
    new TextRun({
      text,
      bold: o.bold,
      italics: o.italics,
      allCaps: o.caps,
      font: o.mono ? "Consolas" : font,
      color: o.color ?? hex(style.bodyColor),
      size: o.size ?? 22,
      shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: "auto" } : undefined,
    });
  /** Multi-line text as one paragraph with line breaks. */
  const lines = (text: string, o: Parameters<typeof run>[1] = {}) => text.split("\n").map((t, i) => (i === 0 ? run(t, o) : new TextRun({ text: t, break: 1, font: o.mono ? "Consolas" : font, color: o.color ?? hex(style.bodyColor), size: o.size ?? 22, bold: o.bold, italics: o.italics })));

  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 60 }, children: [new TextRun({ text: d.titulo, bold: true, font: style.titleFont, color: hex(style.titleColor), size: 48 })] }));
  if (d.subtitulo) out.push(new Paragraph({ spacing: { after: 300 }, children: [run(d.subtitulo, { mono: true, size: 18, color: MUTED })] }));

  const label = (text: string) =>
    new Paragraph({
      spacing: { before: 260, after: 100 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: "005c5c", space: 6 } },
      children: [run(text, { bold: true, caps: true, color: TEAL_DEEP, size: 20 })],
    });
  const body = (text: string) => new Paragraph({ spacing: { after: 80 }, children: lines(text) });
  const muted = (text: string) => new Paragraph({ spacing: { after: 80 }, children: [run(text, { italics: true, color: MUTED })] });
  const mono = (text: string) => new Paragraph({ spacing: { after: 100 }, children: [run(text, { mono: true, size: 17, color: MUTED })] });

  const cell = (children: TextRun[], fill?: string, width?: number) =>
    new TableCell({
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
      shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children })],
    });
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  };
  const widths = [20, 48, 32];

  const etapa = (e: Rb33Etapa) => {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 480, after: 40 }, children: [new TextRun({ text: `Etapa: ${e.nome}`, bold: true, font, color: hex(style.stageColor), size: 30 })] }));
    if (e.idLinha) out.push(mono(e.idLinha));
    if (e.fonteDados) out.push(mono(`Fonte de dados da etapa: ${e.fonteDados}`));

    out.push(label(RB33_SECTION.logica));
    out.push(body(e.logica.join("\n")));
    out.push(label(RB33_SECTION.descricao));
    out.push(body(e.descricao));

    out.push(label(RB33_SECTION.passos));
    for (const p of e.passos) {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 60 }, children: [run(`Passo: ${p.nome}`, { bold: true, size: 23 })] }));
      if (p.fonteDados) out.push(mono(`Fonte de dados do passo: ${p.fonteDados}`));
      if (p.itens.length === 0) out.push(muted("Nenhum campo neste passo."));
      const itemParas = (item: Rb33Item, level: number) => {
        const hidden = !!item.tag && /^Oculto/.test(item.tag);
        const children: TextRun[] = [];
        if (item.tag) children.push(run(` ${item.tag.toUpperCase()} `, { bold: true, size: 16, color: hidden ? AMBER_TEXT : TEAL_DEEP, shade: hidden ? AMBER_TAG : TEAL_SOFT }), run(" "));
        children.push(run(item.nome, { bold: true }));
        if (item.obrigatorio) children.push(run(" *", { bold: true, color: REQUIRED }));
        if (item.cond) children.push(run(` — ${item.cond}`, { italics: true, color: MUTED }));
        out.push(new Paragraph({ bullet: { level }, spacing: { after: item.notas.length ? 20 : 80 }, children }));
        const indent = 720 + level * 360;
        for (const n of item.notas) {
          out.push(new Paragraph({ indent: { left: indent }, spacing: { after: 20 }, children: [run(n.texto, { size: 19, color: MUTED })] }));
          if (n.codigo) out.push(new Paragraph({ indent: { left: indent }, spacing: { after: 60 }, shading: { type: ShadingType.CLEAR, fill: HEADER_FILL, color: "auto" }, children: lines(n.codigo, { mono: true, size: 17 }) }));
        }
      };
      for (const e of p.itens) {
        if (!isGrupoOculto(e)) {
          itemParas(e, 0);
          continue;
        }
        const amber = { type: ShadingType.CLEAR, fill: AMBER_BG, color: "auto" } as const;
        const bar = { left: { style: BorderStyle.SINGLE, size: 24, color: AMBER_BORDER, space: 6 } };
        out.push(new Paragraph({ spacing: { before: 120, after: 0 }, shading: amber, border: bar, children: [run(e.titulo, { bold: true, color: AMBER_TEXT })] }));
        out.push(new Paragraph({ spacing: { after: 60 }, shading: amber, border: bar, children: [run(`Identificado por: ${e.motivo}${e.cond ? ` · agrupamento ${e.cond}` : ""}`, { size: 18, color: AMBER_TEXT })] }));
        if (e.itens.length === 0) out.push(muted("Agrupamento sem campos."));
        for (const i of e.itens) itemParas(i, 1);
      }
    }

    out.push(label(RB33_SECTION.feedbacks));
    if (e.feedbacks.length === 0) out.push(muted("Nenhum feedback configurado."));
    for (const f of e.feedbacks) out.push(new Paragraph({ spacing: { after: 80 }, children: [run(f.rotulo, { bold: true }), ...lines(f.texto)] }));

    out.push(label(RB33_SECTION.acoes));
    if (e.botoes.length === 0) out.push(muted(RB33_SECTION.semAcoes));
    for (const b of e.botoes) {
      out.push(new Paragraph({ spacing: { before: 160, after: 60 }, children: [run(b.titulo, { bold: true }), ...(b.cond ? [run(` — botão ${b.cond}`, { italics: true, size: 19, color: MUTED })] : [])] }));
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders,
          rows: [
            new TableRow({ tableHeader: true, children: RB33_SECTION.colunas.map((h, i) => cell([run(h, { bold: true, caps: true, size: 17, color: "2e3131" })], HEADER_FILL, widths[i])) }),
            ...b.linhas.map(
              (l, idx) =>
                new TableRow({
                  children: [
                    cell([run(l.tipo, { size: 19 })], idx % 2 ? "f8faf9" : undefined, widths[0]),
                    cell(
                      [
                        ...(l.titulo ? [run(l.titulo, { bold: true, size: 19 })] : []),
                        ...(l.descricao ? [run(`${l.titulo ? " " : ""}${l.descricao}`, { size: 19 })] : []),
                        ...(l.queryCode ? [run(` (${l.queryCode})`, { mono: true, size: 17, color: TEAL_DEEP })] : []),
                      ],
                      idx % 2 ? "f8faf9" : undefined,
                      widths[1]
                    ),
                    cell(l.logica ? lines(l.logica, { size: 19 }) : [run("—", { size: 19, color: MUTED })], idx % 2 ? "f8faf9" : undefined, widths[2]),
                  ],
                })
            ),
          ],
        })
      );
    }
    out.push(label(RB33_SECTION.notas));
    out.push(new Paragraph({ spacing: { after: 120 }, children: [run(" ")] }));
  };

  if (d.etapas.length === 0) out.push(muted("Nenhuma etapa ativa encontrada."));
  d.etapas.forEach(etapa);
  return out;
}

/** One process, or several (portal) — each process starts on a new page. */
export async function buildRb33Docx(docs: DocumentacaoPS[], style: StyleConfig, opts: DocOptions = DEFAULT_DOC_OPTIONS): Promise<Blob> {
  const document = new Document({
    styles: { default: { document: { run: { font: style.bodyFont } } } },
    sections: docs.map((d) => ({ children: docChildren(buildRb33Doc(d, opts), style) })),
  });
  return Packer.toBlob(document);
}
