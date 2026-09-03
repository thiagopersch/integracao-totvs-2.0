import type { AcaoBotaoSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, RegraLogicaItem, StyleConfig } from "./types";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function logicaText(logica: RegraLogicaItem[] | undefined): string | undefined {
  if (!logica || logica.length === 0) return undefined;
  return logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ");
}

/** Renders the documentation as styled HTML — single source of truth for both the on-screen
 *  preview (`dangerouslySetInnerHTML`) and the `text/html` clipboard payload used by the
 *  "Copiar para Google Docs" button, so what the user sees is exactly what gets pasted. */
export function renderDocumentHtml(doc: DocumentacaoPS, style: StyleConfig): string {
  const titleStyle = `font-family:'${style.titleFont}',sans-serif;color:${style.titleColor};font-size:26pt;font-weight:900;`;
  const stageStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.stageColor};font-size:15pt;font-weight:700;margin-top:28pt;`;
  const subheadingStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:12pt;font-weight:600;margin-top:10pt;`;
  const bodyStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.bodyColor};font-size:11pt;line-height:1.5;`;
  const codeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:8px;display:block;white-space:pre-wrap;`;

  function fonteDadosHtml(fonte: FonteDadosSpec | undefined): string {
    if (!fonte) return "";
    const contexto = fonte.contexto.length > 0 ? `Contexto: ${esc(fonte.contexto.map((c) => `${c.nome}${c.campoVinculado ? ` -> ${c.campoVinculado}` : ""}`).join(", "))}<br/>` : "";
    return `<li style="${bodyStyle}">Fonte de dados: coligada ${esc(fonte.codColigada)}, sistema ${esc(fonte.codSistema)}, consulta ${esc(fonte.codConsulta)}<br/>Cache: ${fonte.usaCache ? `sim (frequência: ${esc(fonte.frequenciaCache ?? "não informada")})` : "não"}<br/>${contexto}</li>`;
  }

  function acaoHtml(acao: AcaoBotaoSpec): string {
    const parts = [`[${acao.ordem}] (${esc(acao.grupo)}) ${esc(acao.descricao)}${acao.acaoParametrizada ? ` — ação: ${esc(acao.acaoParametrizada)}` : ""}${acao.ativada ? "" : " [desativada]"}`];
    if (acao.mensagemErro) parts.push(`Mensagem de erro: ${esc(acao.mensagemErro)}`);
    if (acao.camposConfigurados.length > 0) parts.push(`Campos configurados: ${esc(acao.camposConfigurados.join(", "))}`);
    const condicao = logicaText(acao.logica);
    if (condicao) parts.push(`Condição: ${esc(condicao)}`);
    return `<li style="${bodyStyle}">${parts.join("<br/>")}</li>`;
  }

  function encaminhamentoHtml(enc: EncaminhamentoSpec): string {
    const parts = [`Destino: ${esc(enc.destino)}${enc.novaAba ? " (nova aba)" : ""}`];
    const condicao = logicaText(enc.logica);
    if (condicao) parts.push(`Condição: ${esc(condicao)}`);
    return `<li style="${bodyStyle}">${parts.join("<br/>")}</li>`;
  }

  function itemHtml(item: ItemSpec): string {
    const classeCss = item.classeCss ? ` <code>.${esc(item.classeCss)}</code>` : "";
    const totvs = item.integracaoTotvs ? [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".") : "";
    const totvsHtml = totvs ? ` [TOTVS: ${esc(totvs)}]` : "";
    const fonteHtml = item.fonteDados ? `<ul>${fonteDadosHtml(item.fonteDados)}</ul>` : "";
    const logicaSuffix = logicaText(item.logica) ? ` — lógica: ${esc(logicaText(item.logica)!)}` : "";

    switch (item.categoria) {
      case "campo": {
        const regras = item.regras && item.regras.length ? ` — <em>${esc(item.regras.join("; "))}</em>` : "";
        return `<li style="${bodyStyle}">Campo <strong>${esc(item.nome)}</strong> (${esc(item.tipo)})${classeCss}${regras}${logicaSuffix}${totvsHtml}${fonteHtml}</li>`;
      }
      case "texto":
        return `<li style="${bodyStyle}">Texto: "${esc(item.conteudoHtml ?? "")}"${classeCss}${logicaSuffix}</li>`;
      case "agrupamento": {
        const cols = item.numColunas ? ` — ${item.numColunas} colunas` : item.larguraColuna ? ` — largura ${esc(item.larguraColuna)}` : "";
        const bg = item.temBackground ? `<br/>Background: ${item.corBackground ? `cor ${esc(item.corBackground)}` : item.temImagemBackground ? "possui imagem" : "configurado"}` : "";
        const filhos = (item.filhos ?? []).map(itemHtml).join("");
        return `<li style="${bodyStyle}">Agrupamento <strong>${esc(item.nome)}</strong>${cols}${classeCss}${item.alinhamento ? ` — ${esc(item.alinhamento)}` : ""}${logicaSuffix}${bg}${filhos ? `<ul>${filhos}</ul>` : ""}</li>`;
      }
      case "botao": {
        const acoes = (item.acoes ?? []).map(acaoHtml).join("");
        const encaminhamentos = (item.encaminhamentos ?? []).map(encaminhamentoHtml).join("");
        return `<li style="${bodyStyle}">Botão <strong>${esc(item.nome)}</strong> — tema: ${esc(item.tema ?? "padrão")}; cor: ${esc(item.corBotao ?? "padrão")}${item.usaCorInstitucional ? " (institucional)" : ""}; texto: ${esc(item.corTexto ?? "padrão")}${classeCss}<br/>Ícone: ${item.temIcone ? "sim" : "não"}; Escondido: ${item.escondido ? "sim" : "não"}; Salva dados: ${item.salvaDados ? "sim" : "não"}; Redireciona: ${item.redirecionaUsuario ? "sim" : "não"}${acoes ? `<p style="${bodyStyle}"><strong>Ações (em ordem):</strong></p><ul>${acoes}</ul>` : ""}${encaminhamentos ? `<p style="${bodyStyle}"><strong>Encaminhamentos:</strong></p><ul>${encaminhamentos}</ul>` : ""}</li>`;
      }
      case "cep":
        return `<li style="${bodyStyle}">Componente de CEP <strong>${esc(item.nome)}</strong>${classeCss} — campo vinculado: ${esc(item.campoCepVinculado ?? "(não identificado)")}; editável: ${item.editavel ? "sim" : "não"}</li>`;
      case "html":
        return `<li style="${bodyStyle}">Componente HTML <strong>${esc(item.nome)}</strong> (tipo: ${item.tipoHtml})${classeCss}<code style="${codeStyle}">${esc(item.conteudoHtml ?? "")}</code></li>`;
      case "upload": {
        const alvos = (item.camposVinculadosUpload ?? []).map((a) => `${esc(a.papel)}: ${esc(a.campo)}`).join("<br/>");
        return `<li style="${bodyStyle}">Componente de Upload <strong>${esc(item.nome)}</strong>${classeCss} — máx. ${item.tamanhoMaximoMb ?? "?"}MB; múltiplos: ${item.multiplosArquivos ? "sim" : "não"}${alvos ? `<br/>${alvos}` : ""}</li>`;
      }
      default:
        return `<li style="${bodyStyle}">Componente <strong>${esc(item.nome)}</strong> (${esc(item.tipo)})${classeCss}${logicaSuffix}</li>`;
    }
  }

  const parts: string[] = [];
  parts.push(`<h1 style="${titleStyle}">${esc(doc.tituloPortal)}</h1>`);

  for (const etapa of doc.etapas) {
    parts.push(`<h2 style="${stageStyle}">Etapa: ${esc(etapa.nome)}</h2>`);
    parts.push(`<h4 style="${subheadingStyle}">Lógica de exibição</h4>`);
    parts.push(`<p style="${bodyStyle}">${esc(etapa.logicaExibicao)}</p>`);
    parts.push(`<h4 style="${subheadingStyle}">Descrição</h4>`);
    parts.push(`<p style="${bodyStyle}">${esc(etapa.descricao)}</p>`);

    if (etapa.fontesDados.length > 0) {
      parts.push(`<h4 style="${subheadingStyle}">Fontes de dados</h4>`);
      parts.push(`<p style="${bodyStyle}">TOTVS/Rubeus: ${esc(etapa.fontesDados.join(", "))}</p>`);
    }

    if (etapa.passos.length > 0) {
      parts.push(`<h4 style="${subheadingStyle}">Passos</h4>`);
      etapa.passos.forEach((passo, index) => {
        parts.push(`<h4 style="${subheadingStyle}">Passo ${index + 1}: ${esc(passo.nome)}</h4>`);
        parts.push(`<ul>${passo.itens.map(itemHtml).join("")}</ul>`);
      });
    }

    if (etapa.feedbacks.length > 0) {
      parts.push(`<h4 style="${subheadingStyle}">Feedbacks</h4>`);
      const items = etapa.feedbacks
        .map((f, i) => `<li style="${bodyStyle}">Feedback ${i + 1} (${esc(f.nome)})${f.conclusivo ? " <em>[conclusivo]</em>" : ""}: ${esc(f.condicao)}</li>`)
        .join("");
      parts.push(`<ul>${items}</ul>`);
    }
  }

  return parts.join("\n");
}
