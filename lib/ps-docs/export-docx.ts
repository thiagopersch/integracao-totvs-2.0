import { Document, Packer, Paragraph, TextRun } from "docx";
import type { AcaoBotaoSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, RegraLogicaItem, StyleConfig } from "./types";

const hex = (color: string) => color.replace("#", "");

function logicaText(logica: RegraLogicaItem[] | undefined): string | undefined {
  if (!logica || logica.length === 0) return undefined;
  return logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ");
}

/** Builds the .docx replicating the 4 heading levels found in the reference template
 *  (Heading1 title / Heading2 "Etapa: X" / Heading4 subsections / Normal body), with the
 *  colors/fonts chosen in the style panel. Runs entirely in the browser via `Packer.toBlob`. */
export async function buildDocx(doc: DocumentacaoPS, style: StyleConfig): Promise<Blob> {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: doc.tituloPortal, bold: true, font: style.titleFont, color: hex(style.titleColor), size: 52 })],
    })
  );

  const stage = (text: string) =>
    new Paragraph({
      spacing: { before: 400, after: 160 },
      children: [new TextRun({ text, bold: true, font: style.bodyFont, color: hex(style.stageColor), size: 30 })],
    });

  const subheading = (text: string) =>
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text, bold: true, font: style.bodyFont, color: hex(style.subheadingColor), size: 24 })],
    });

  const body = (text: string, options: { bullet?: boolean; bold?: boolean; indent?: number } = {}) =>
    new Paragraph({
      spacing: { after: 80 },
      bullet: options.bullet ? { level: options.indent ?? 0 } : undefined,
      indent: !options.bullet && options.indent ? { left: options.indent * 360 } : undefined,
      children: [new TextRun({ text, font: style.bodyFont, color: hex(style.bodyColor), size: 22, bold: options.bold })],
    });

  function fonteDadosParagraphs(fonte: FonteDadosSpec | undefined, indent: number): Paragraph[] {
    if (!fonte) return [];
    const out = [
      body(`Fonte de dados: coligada ${fonte.codColigada}, sistema ${fonte.codSistema}, consulta ${fonte.codConsulta}`, { bullet: true, indent }),
      body(`Cache: ${fonte.usaCache ? `sim (frequência: ${fonte.frequenciaCache ?? "não informada"})` : "não"}`, { indent: indent + 1 }),
    ];
    if (fonte.contexto.length > 0) {
      out.push(body(`Contexto: ${fonte.contexto.map((c) => `${c.nome}${c.campoVinculado ? ` -> ${c.campoVinculado}` : ""}`).join(", ")}`, { indent: indent + 1 }));
    }
    return out;
  }

  function acaoParagraphs(acao: AcaoBotaoSpec, indent: number): Paragraph[] {
    const out = [body(`[${acao.ordem}] (${acao.grupo}) ${acao.descricao}${acao.acaoParametrizada ? ` — ação: ${acao.acaoParametrizada}` : ""}${acao.ativada ? "" : " [desativada]"}`, { bullet: true, indent })];
    if (acao.mensagemErro) out.push(body(`Mensagem de erro: ${acao.mensagemErro}`, { indent: indent + 1 }));
    if (acao.camposConfigurados.length > 0) out.push(body(`Campos configurados: ${acao.camposConfigurados.join(", ")}`, { indent: indent + 1 }));
    const condicao = logicaText(acao.logica);
    if (condicao) out.push(body(`Condição: ${condicao}`, { indent: indent + 1 }));
    out.push(...fonteDadosParagraphs(acao.fonteDados, indent + 1));
    return out;
  }

  function encaminhamentoParagraphs(enc: EncaminhamentoSpec, indent: number): Paragraph[] {
    const out = [body(`Destino: ${enc.destino}${enc.novaAba ? " (nova aba)" : ""}`, { bullet: true, indent })];
    const condicao = logicaText(enc.logica);
    if (condicao) out.push(body(`Condição: ${condicao}`, { indent: indent + 1 }));
    return out;
  }

  function itemParagraphs(item: ItemSpec, indent: number): Paragraph[] {
    const classeCss = item.classeCss ? ` [.${item.classeCss}]` : "";
    const totvs = item.integracaoTotvs ? [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".") : "";
    const totvsSuffix = totvs ? ` [TOTVS: ${totvs}]` : "";
    const logicaSuffix = logicaText(item.logica) ? ` — lógica: ${logicaText(item.logica)}` : "";
    const out: Paragraph[] = [];

    switch (item.categoria) {
      case "campo": {
        const regras = item.regras && item.regras.length > 0 ? ` (${item.regras.join("; ")})` : "";
        out.push(body(`Campo ${item.nome} — ${item.tipo}${classeCss}${regras}${logicaSuffix}${totvsSuffix}`, { bullet: true, indent }));
        break;
      }
      case "texto":
        out.push(body(`Texto: "${item.conteudoHtml}"${classeCss}${logicaSuffix}`, { bullet: true, indent }));
        break;
      case "agrupamento": {
        const cols = item.numColunas ? ` — ${item.numColunas} colunas` : item.larguraColuna ? ` — largura ${item.larguraColuna}` : "";
        out.push(body(`Agrupamento ${item.nome}${cols}${classeCss}${item.alinhamento ? ` — ${item.alinhamento}` : ""}${logicaSuffix}`, { bullet: true, indent }));
        if (item.temBackground) out.push(body(`Background: ${item.corBackground ? `cor ${item.corBackground}` : item.temImagemBackground ? "possui imagem" : "configurado"}`, { indent: indent + 1 }));
        for (const child of item.filhos ?? []) out.push(...itemParagraphs(child, indent + 1));
        break;
      }
      case "botao": {
        out.push(body(`Botão ${item.nome} — tema: ${item.tema ?? "padrão"}; cor: ${item.corBotao ?? "padrão"}${item.usaCorInstitucional ? " (institucional)" : ""}; texto: ${item.corTexto ?? "padrão"}${classeCss}`, { bullet: true, indent }));
        out.push(body(`Ícone: ${item.temIcone ? "sim" : "não"}; Escondido: ${item.escondido ? "sim" : "não"}; Salva dados: ${item.salvaDados ? "sim" : "não"}; Redireciona: ${item.redirecionaUsuario ? "sim" : "não"}`, { indent: indent + 1 }));
        if (item.acoes && item.acoes.length > 0) {
          out.push(body("Ações (em ordem):", { bold: true, indent: indent + 1 }));
          for (const acao of item.acoes) out.push(...acaoParagraphs(acao, indent + 2));
        }
        if (item.encaminhamentos && item.encaminhamentos.length > 0) {
          out.push(body("Encaminhamentos:", { bold: true, indent: indent + 1 }));
          for (const enc of item.encaminhamentos) out.push(...encaminhamentoParagraphs(enc, indent + 2));
        }
        break;
      }
      case "cep":
        out.push(body(`Componente de CEP ${item.nome}${classeCss} — campo vinculado: ${item.campoCepVinculado ?? "(não identificado)"}; editável: ${item.editavel ? "sim" : "não"}`, { bullet: true, indent }));
        break;
      case "html":
        out.push(body(`Componente HTML ${item.nome} (tipo: ${item.tipoHtml})${classeCss}`, { bullet: true, indent }));
        out.push(body(item.conteudoHtml ?? "", { indent: indent + 1 }));
        break;
      case "upload": {
        out.push(body(`Componente de Upload ${item.nome}${classeCss} — máx. ${item.tamanhoMaximoMb ?? "?"}MB; múltiplos: ${item.multiplosArquivos ? "sim" : "não"}`, { bullet: true, indent }));
        for (const alvo of item.camposVinculadosUpload ?? []) out.push(body(`${alvo.papel}: ${alvo.campo}`, { indent: indent + 1 }));
        break;
      }
      default:
        out.push(body(`Componente ${item.nome} (${item.tipo})${classeCss}${logicaSuffix}`, { bullet: true, indent }));
    }

    return out;
  }

  for (const etapa of doc.etapas) {
    paragraphs.push(stage(`Etapa: ${etapa.nome}`));
    paragraphs.push(subheading("Lógica de exibição"));
    paragraphs.push(body(etapa.logicaExibicao));
    paragraphs.push(subheading("Descrição"));
    paragraphs.push(body(etapa.descricao));

    if (etapa.fontesDados.length > 0) {
      paragraphs.push(subheading("Fontes de dados"));
      paragraphs.push(body(`TOTVS/Rubeus: ${etapa.fontesDados.join(", ")}`));
    }

    if (etapa.passos.length > 0) {
      paragraphs.push(subheading("Passos"));
      etapa.passos.forEach((passo, index) => {
        paragraphs.push(subheading(`Passo ${index + 1}: ${passo.nome}`));
        for (const item of passo.itens) paragraphs.push(...itemParagraphs(item, 0));
      });
    }

    if (etapa.feedbacks.length > 0) {
      paragraphs.push(subheading("Feedbacks"));
      etapa.feedbacks.forEach((feedback, index) => {
        const conclusivo = feedback.conclusivo ? " [conclusivo]" : "";
        paragraphs.push(body(`Feedback ${index + 1} (${feedback.nome})${conclusivo}: ${feedback.condicao}`, { bullet: true }));
      });
    }
  }

  const document = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(document);
}
