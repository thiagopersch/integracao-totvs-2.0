import type { AcaoBotaoSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, RegraLogicaItem } from "./types";

function logicaLine(logica: RegraLogicaItem[] | undefined): string {
  if (!logica || logica.length === 0) return "";
  return ` — lógica: ${logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ")}`;
}

function fonteDadosLines(fonte: FonteDadosSpec | undefined, indent: string): string[] {
  if (!fonte) return [];
  const lines = [
    `${indent}- Fonte de dados: coligada ${fonte.codColigada}, sistema ${fonte.codSistema}, consulta ${fonte.codConsulta}`,
    `${indent}  Cache: ${fonte.usaCache ? `sim (frequência: ${fonte.frequenciaCache ?? "não informada"})` : "não"}`,
  ];
  if (fonte.contexto.length > 0) {
    lines.push(`${indent}  Contexto: ${fonte.contexto.map((c) => `${c.nome}${c.campoVinculado ? ` -> ${c.campoVinculado}` : ""}`).join(", ")}`);
  }
  return lines;
}

function acaoLines(acao: AcaoBotaoSpec, indent: string): string[] {
  const lines = [`${indent}- [${acao.ordem}] (${acao.grupo}) ${acao.descricao}${acao.acaoParametrizada ? ` — ação: ${acao.acaoParametrizada}` : ""}${acao.ativada ? "" : " [desativada]"}`];
  if (acao.mensagemErro) lines.push(`${indent}  Mensagem de erro: ${acao.mensagemErro}`);
  if (acao.camposConfigurados.length > 0) lines.push(`${indent}  Campos configurados: ${acao.camposConfigurados.join(", ")}`);
  if (acao.logica && acao.logica.length > 0) lines.push(`${indent}  Condição: ${acao.logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ")}`);
  lines.push(...fonteDadosLines(acao.fonteDados, indent));
  return lines;
}

function encaminhamentoLines(enc: EncaminhamentoSpec, indent: string): string[] {
  const lines = [`${indent}- Destino: ${enc.destino}${enc.novaAba ? " (nova aba)" : ""}`];
  if (enc.logica && enc.logica.length > 0) lines.push(`${indent}  Condição: ${enc.logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ")}`);
  return lines;
}

/** Renders one item (and, for "agrupamento", its children) as a Markdown bullet, indented by
 *  nesting depth — mirrors the order and hierarchy configured in the builder. */
function itemLines(item: ItemSpec, depth: number): string[] {
  const indent = "  ".repeat(depth);
  const classeCss = item.classeCss ? ` \`.${item.classeCss}\`` : "";
  const lines: string[] = [];

  switch (item.categoria) {
    case "campo": {
      const regras = item.regras && item.regras.length > 0 ? ` _(${item.regras.join("; ")})_` : "";
      lines.push(`${indent}- Campo **${item.nome}** (${item.tipo})${classeCss}${regras}${logicaLine(item.logica)}`);
      break;
    }
    case "texto":
      lines.push(`${indent}- Texto: "${item.conteudoHtml}"${classeCss}${logicaLine(item.logica)}`);
      break;
    case "agrupamento": {
      const cols = item.numColunas ? ` — ${item.numColunas} colunas` : item.larguraColuna ? ` — largura ${item.larguraColuna}` : "";
      lines.push(`${indent}- Agrupamento **${item.nome}**${cols}${classeCss}${item.alinhamento ? ` — ${item.alinhamento}` : ""}${logicaLine(item.logica)}`);
      if (item.padding) lines.push(`${indent}  Padding: ${item.padding}`);
      if (item.larguraMaxima) lines.push(`${indent}  Largura máxima: ${item.larguraMaxima}`);
      if (item.temBackground) lines.push(`${indent}  Background: ${item.corBackground ? `cor ${item.corBackground}` : item.temImagemBackground ? "possui imagem" : "configurado"}`);
      if (item.cssCodigo) lines.push(`${indent}  CSS customizado: presente (ver .docx/preview para o código completo)`);
      (item.filhos ?? []).forEach((child) => lines.push(...itemLines(child, depth + 1)));
      break;
    }
    case "botao": {
      lines.push(`${indent}- Botão **${item.nome}** — tema: ${item.tema ?? "padrão"}; cor: ${item.corBotao ?? "padrão"}${item.usaCorInstitucional ? " (institucional)" : ""}; texto: ${item.corTexto ?? "padrão"}${classeCss}`);
      lines.push(`${indent}  Ícone: ${item.temIcone ? "sim" : "não"}; Escondido: ${item.escondido ? "sim" : "não"}; Salva dados: ${item.salvaDados ? "sim" : "não"}; Redireciona usuário: ${item.redirecionaUsuario ? "sim" : "não"}`);
      if (item.acoes && item.acoes.length > 0) {
        lines.push(`${indent}  Ações (em ordem):`);
        for (const acao of item.acoes) lines.push(...acaoLines(acao, indent + "  "));
      }
      if (item.encaminhamentos && item.encaminhamentos.length > 0) {
        lines.push(`${indent}  Encaminhamentos:`);
        for (const enc of item.encaminhamentos) lines.push(...encaminhamentoLines(enc, indent + "  "));
      }
      break;
    }
    case "cep":
      lines.push(`${indent}- Componente de CEP **${item.nome}**${classeCss} — campo vinculado: ${item.campoCepVinculado ?? "(não identificado)"}; editável: ${item.editavel ? "sim" : "não"}`);
      break;
    case "html":
      lines.push(`${indent}- Componente HTML **${item.nome}** (tipo: ${item.tipoHtml})${classeCss}`);
      lines.push(`${indent}  \`\`\``);
      lines.push(`${indent}  ${(item.conteudoHtml ?? "").split("\n").join(`\n${indent}  `)}`);
      lines.push(`${indent}  \`\`\``);
      break;
    case "upload":
      lines.push(`${indent}- Componente de Upload **${item.nome}**${classeCss} — máx. ${item.tamanhoMaximoMb ?? "?"}MB; múltiplos arquivos: ${item.multiplosArquivos ? "sim" : "não"}`);
      if (item.camposVinculadosUpload && item.camposVinculadosUpload.length > 0) {
        for (const alvo of item.camposVinculadosUpload) lines.push(`${indent}  ${alvo.papel}: ${alvo.campo}`);
      }
      break;
    default:
      lines.push(`${indent}- Componente **${item.nome}** (${item.tipo})${classeCss}${logicaLine(item.logica)}`);
  }

  if (item.integracaoTotvs) {
    const totvs = [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".");
    if (totvs) lines.push(`${indent}  TOTVS: ${totvs}`);
  }
  lines.push(...fonteDadosLines(item.fonteDados, indent));

  return lines;
}

/** Plain structural Markdown (no color/font — Markdown has no concept of either). Used for the
 *  ".md" download and as the `text/plain` fallback when copying for Google Docs. */
export function documentToMarkdown(doc: DocumentacaoPS): string {
  const lines: string[] = [];
  lines.push(`# ${doc.tituloPortal}`, "");

  for (const etapa of doc.etapas) {
    lines.push(`## Etapa: ${etapa.nome}`, "");
    lines.push("#### Lógica de exibição", "", etapa.logicaExibicao, "");
    lines.push("#### Descrição", "", etapa.descricao, "");
    if (etapa.fontesDados.length > 0) {
      lines.push("#### Fontes de dados", "", `TOTVS/Rubeus: ${etapa.fontesDados.join(", ")}`, "");
    }

    if (etapa.passos.length > 0) {
      lines.push("#### Passos", "");
      etapa.passos.forEach((passo, index) => {
        lines.push(`##### Passo ${index + 1}: ${passo.nome}`, "");
        for (const item of passo.itens) lines.push(...itemLines(item, 0));
        lines.push("");
      });
    }

    if (etapa.feedbacks.length > 0) {
      lines.push("#### Feedbacks", "");
      etapa.feedbacks.forEach((feedback, index) => {
        const conclusivo = feedback.conclusivo ? " [conclusivo]" : "";
        lines.push(`- Feedback ${index + 1} (${feedback.nome})${conclusivo}: ${feedback.condicao}`);
      });
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}
