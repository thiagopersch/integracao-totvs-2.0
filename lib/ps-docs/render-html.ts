import type { AcaoBotaoSpec, CampoDetalhado, ColunaDataserverSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, ParametroAcaoSpec, RegraLogicaItem, StyleConfig } from "./types";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function logicaText(logica: RegraLogicaItem[] | undefined): string | undefined {
  if (!logica || logica.length === 0) return undefined;
  return logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ");
}

const sim = (v: boolean | undefined) => (v ? "Sim" : "Não");

const CATEGORIA_LABEL: Record<ItemSpec["categoria"], string> = {
  campo: "Campo",
  texto: "Texto",
  agrupamento: "Agrupamento",
  botao: "Botão",
  cep: "Componente de CEP",
  html: "Componente HTML",
  upload: "Componente de Upload",
  componente: "Componente",
};

/** Renders the documentation as styled HTML — single source of truth for both the on-screen
 *  preview (`dangerouslySetInnerHTML`) and the `text/html` clipboard payload used by the
 *  "Copiar para Google Docs" button, so what the user sees is exactly what gets pasted.
 *
 *  Heading hierarchy (role-based, not depth-based): h1 processo seletivo, h2 etapa, h3 passo,
 *  h4 componente, h5 campo, h6 each campo/componente's own property groups (Identificação/
 *  Básico/Validação/Dados/Propriedades/Vínculos for a campo; Geral/Personalização/Alinhamento/
 *  Ações/Configuração for a componente) — h3-h6 all use `subheadingColor` at decreasing sizes.
 *  Every value is highlighted in `<strong>` — code-like values (regex, custom-validation JS,
 *  HTML/CSS/JS component content) go in `<code>` instead. */
export function renderDocumentHtml(doc: DocumentacaoPS, style: StyleConfig): string {
  const titleStyle = `font-family:'${style.titleFont}',sans-serif;color:${style.titleColor};font-size:26pt;font-weight:900;`;
  const stageStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.stageColor};font-size:15pt;font-weight:700;margin-top:28pt;`;
  const h3Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:13pt;font-weight:700;margin-top:20pt;`;
  const h4Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:12pt;font-weight:700;margin-top:14pt;`;
  const h5Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:11pt;font-weight:700;margin-top:10pt;`;
  const h6Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:10pt;font-weight:600;margin-top:8pt;`;
  const bodyStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.bodyColor};font-size:11pt;line-height:1.5;`;
  const codeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:8px;display:block;white-space:pre-wrap;`;
  const inlineCodeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:1px 4px;`;
  // Explicit list styling: the host page (Tailwind preflight) zeroes out `ul`/`ol` margin/padding
  // and sets `list-style:none` by default, which collapses raw `<ul><li>` markup into flat,
  // unindented text — this is what makes bullets/indentation show up regardless of the page's CSS.
  const ulStyle = `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`;

  /** "Label: <strong>value</strong>" — the highlighted-value line format used everywhere. */
  const kv = (label: string, value: string) => `${esc(label)}: <strong>${esc(value)}</strong>`;
  const kvCode = (label: string, value: string) => `${esc(label)}: <code style="${inlineCodeStyle}">${esc(value)}</code>`;

  /** One `<li>` per sub-item — used for the handful of places that still need list nesting
   *  *within* one h6 section (e.g. each validation rule's own Mensagem/Valor/Inverter). */
  function subList(items: (string | null | undefined | false)[]): string {
    const filtered = items.filter((i): i is string => !!i);
    return filtered.length > 0 ? `<ul style="${ulStyle}">${filtered.map((i) => `<li style="${bodyStyle}">${i}</li>`).join("")}</ul>` : "";
  }

  function h6(title: string, innerHtml: string): string {
    if (!innerHtml) return "";
    return `<h6 style="${h6Style}">${esc(title)}</h6>${innerHtml}`;
  }

  /** codConsulta/codSistema/codColigada + cache/frequência + contexto — never lists the fields a
   *  query returns, only the query's own configuration (per explicit instruction). */
  function fonteDadosHtml(fonte: FonteDadosSpec): string {
    if (!fonte.configurada) return `<p style="${bodyStyle}">Fonte de dados: <strong>nenhuma consulta vinculada</strong></p>`;
    const temContexto = fonte.contexto.length > 0;
    return (
      `<p style="${bodyStyle}"><strong>Fonte de dados</strong></p>` +
      subList([
        kv("Coligada", fonte.codColigada),
        kv("Sistema", fonte.codSistema),
        kv("Consulta", fonte.codConsulta),
        kv("Cache", sim(fonte.usaCache)),
        fonte.usaCache ? kv("Frequência do cache", fonte.frequenciaCache ?? "não informada") : null,
        kv("Contexto", sim(temContexto)),
        temContexto ? `${esc("Parâmetros do contexto")}${subList(fonte.contexto.map((c) => (c.campoVinculado ? kv(c.nome, c.campoVinculado) : esc(c.nome))))}` : null,
      ])
    );
  }

  function parametrosHtml(parametros: ParametroAcaoSpec[]): string {
    return `${kv("Parâmetros", sim(parametros.length > 0))}${subList(
      parametros.map(
        (p) =>
          `${esc(p.nome)} - ${esc(p.tipo)}${subList([
            p.tipo === "Campo do sistema" && p.campoSistema ? kv("Campo do sistema", p.campoSistema) : null,
            p.tipo === "Valor fixo" && p.valorFixo !== undefined ? kv("Valor fixo", p.valorFixo) : null,
          ])}`
      )
    )}`;
  }

  function colunasHtml(colunas: ColunaDataserverSpec[]): string | null {
    if (colunas.length === 0) return null;
    return `${esc("Colunas")}${subList(colunas.map((c) => kv(`${c.coluna}${c.tabela ? ` (${c.tabela})` : ""}`, c.correspondente)))}`;
  }

  /** One action per the user's exact target format — the fields shown depend on `tipoAcao`:
   *  Realizar Consulta shows its own código/campos vinculados/parâmetros (and NO Fonte de dados
   *  block, since that's already this); Salvar Dados/Executar processo show the dataserver +
   *  Coluna/Tabela/Correspondente table; Ação Rubeus shows campos configurados + eventos + pessoa
   *  vinculada, no parâmetros table. */
  function acaoHtml(acao: AcaoBotaoSpec): string {
    const header = `[${acao.ordem}] Tipo da ação: <strong>${esc(acao.tipoAcao)}</strong>${acao.ativada ? "" : " <strong>[desativada]</strong>"}`;
    const condicao = logicaText(acao.logica);

    let body: (string | null)[];
    if (acao.tipoAcao === "Realizar consulta") {
      body = [
        kv("Código da consulta", acao.acaoParametrizada ?? "não identificado"),
        `${kv("Possui campo vinculado", sim(acao.camposConfigurados.length > 0))}${
          acao.camposConfigurados.length > 0 ? subList([`${esc("Campos")}${subList(acao.camposConfigurados.map((c) => esc(c)))}`]) : ""
        }`,
        parametrosHtml(acao.parametros),
      ];
    } else if (acao.tipoAcao === "Salvar dados" || acao.tipoAcao === "Executar processo") {
      body = [kv("Dataserver", acao.dataserver ?? "não identificado"), acao.colunas ? colunasHtml(acao.colunas) : null, parametrosHtml(acao.parametros)];
    } else if (acao.tipoAcao === "Ação Rubeus") {
      body = [
        acao.camposConfigurados.length > 0 ? `${esc("Campos configurados")}${subList(acao.camposConfigurados.map((c) => esc(c)))}` : null,
        acao.eventos && acao.eventos.length > 0
          ? `${esc("Eventos")}${subList(acao.eventos.map((e) => `<strong>${esc(e.codigo)} - ${esc(e.descricao ?? "(evento não identificado)")}</strong>`))}`
          : null,
        acao.pessoaVinculada
          ? `${esc("Pessoa vinculada")}${subList([
              kv("Identificador do contato", acao.pessoaVinculada.identificadorContato ?? "não informado"),
              acao.pessoaVinculada.tipoContato ? kv("Tipo do contato", acao.pessoaVinculada.tipoContato) : null,
              kv("Altera contato principal", sim(acao.pessoaVinculada.alterarContatoPrincipal)),
            ])}`
          : null,
      ];
    } else {
      body = [acao.camposConfigurados.length > 0 ? `${esc("Campos configurados")}${subList(acao.camposConfigurados.map((c) => esc(c)))}` : null, parametrosHtml(acao.parametros)];
    }

    const children = subList([
      acao.mensagemErro ? kv("Mensagem de erro", acao.mensagemErro) : null,
      ...body,
      condicao ? kv("Condição", condicao) : null,
    ]);
    const fonte = acao.fonteDados !== undefined ? fonteDadosHtml(acao.fonteDados) : "";
    return `<li style="${bodyStyle}">${header}${children}${fonte}</li>`;
  }

  function encaminhamentoHtml(enc: EncaminhamentoSpec): string {
    const condicao = logicaText(enc.logica);
    const destino = enc.destino !== enc.tipo ? `${kv("Destino", enc.destino)}${enc.novaAba ? " (nova aba)" : ""}` : enc.novaAba ? kv("Nova aba", "Sim") : "";
    return `<li style="${bodyStyle}">${kv("Tipo", enc.tipo)}${subList([
      destino || null,
      enc.parametros && enc.parametros.length > 0 ? parametrosHtml(enc.parametros) : null,
      condicao ? kv("Lógica", condicao) : null,
    ])}</li>`;
  }

  function validacaoHtml(v: CampoDetalhado["validacoes"][number]): string {
    const isRegex = v.tipo.toLowerCase().includes("regular");
    const children = subList([
      v.mensagem ? kv("Mensagem", v.mensagem) : null,
      v.valor ? (isRegex ? kvCode("Valor", v.valor) : kv("Valor", v.valor)) : null,
      v.inverter !== undefined ? kv("Inverter", sim(v.inverter)) : null,
      v.codigo ? `${esc("Código")}<code style="${codeStyle}">${esc(v.codigo)}</code>` : null,
    ]);
    return `<li style="${bodyStyle}">${kv(v.tipo, sim(v.ativado))}${children}</li>`;
  }

  /** A campo's own detail — Identificação/Básico/Multivalorado/Validação/Dados/Propriedades/
   *  Vínculos, each its own `<h6>`. */
  function campoDetalhesHtml(detalhes: CampoDetalhado): string {
    const id = detalhes.identidade;
    const b = detalhes.basico;
    const dd = detalhes.dados;

    const identidade = h6(
      "Identificação",
      subList([
        kv("Tipo", id.tipoCampo),
        id.tabelaProcessoSeletivo ? kv("Tabela do processo seletivo", id.tabelaProcessoSeletivo) : null,
        kv("Multivalorado", sim(id.multivalorado)),
        id.integracaoRubeus ? `${kv("Integração Rubeus", sim(id.integracaoRubeus.ativada))}${id.integracaoRubeus.ativada ? subList([kv("Tabela | Coluna", `${id.integracaoRubeus.tabela ?? ""} | ${id.integracaoRubeus.coluna ?? ""}`)]) : ""}` : null,
        id.integracaoTotvs
          ? `${kv("Integração TOTVS", sim(id.integracaoTotvs.ativada))}${id.integracaoTotvs.ativada ? subList([kv("Tabela.Campo", `${id.integracaoTotvs.tabela ?? ""}.${id.integracaoTotvs.campo ?? ""}`), id.integracaoTotvs.nomeAlternativo ? kv("Nome alternativo", id.integracaoTotvs.nomeAlternativo) : null]) : ""}`
          : null,
      ])
    );

    const basico = h6(
      "Básico",
      subList([
        b.rotulo ? kv("Rótulo", b.rotulo) : null,
        b.placeholder ? kv("Placeholder", b.placeholder) : null,
        b.posicaoRotulo ? kv("Posição do rótulo", b.posicaoRotulo) : null,
        b.transformarTexto ? kv("Transformar texto", b.transformarTexto) : null,
        b.descricao ? kv("Descrição", b.descricao) : null,
        b.dica ? kv("Dica", b.dica) : null,
        b.mascara ? kv("Máscara", b.mascara) : null,
        b.sufixo ? kv("Sufixo", b.sufixo) : null,
        b.prefixo ? kv("Prefixo", b.prefixo) : null,
        b.classeCss ? kvCode("Classe CSS", b.classeCss) : null,
        kv("Desabilitar", sim(b.desabilitar)),
        kv("Esconder", sim(b.esconder)),
        kv("Esconder rótulo", sim(b.esconderRotulo)),
      ])
    );

    const multivalorado = detalhes.multivalorado
      ? h6(
          "Multivalorado",
          subList([
            detalhes.multivalorado.minOpcoes != null ? kv("Mínimo de opções", String(detalhes.multivalorado.minOpcoes)) : null,
            detalhes.multivalorado.maxOpcoes != null ? kv("Máximo de opções", String(detalhes.multivalorado.maxOpcoes)) : null,
          ])
        )
      : "";

    const validacoes = detalhes.validacoes.length > 0 ? h6("Validação", `<ul style="${ulStyle}">${detalhes.validacoes.map(validacaoHtml).join("")}</ul>`) : "";

    const dadosItems: string[] = [];
    if (dd.tipoValorPadrao) dadosItems.push(kv(`Valor padrão (${dd.tipoValorPadrao})`, dd.valorPadrao ?? ""));
    if (dd.fonteExterna) {
      dadosItems.push(
        `${esc("Fonte externa")}${subList([
          kv("Tipo de envio", dd.fonteExterna.tipoEnvio ?? "não informado"),
          kv("Link", dd.fonteExterna.link ?? "não informado"),
          kv("Salva automaticamente", sim(dd.fonteExterna.salvaAutomaticamente)),
          kv("Envia parâmetros", sim(dd.fonteExterna.enviaParametros)),
          dd.fonteExterna.parametros.length > 0 ? `${esc("Parâmetros")}${subList(dd.fonteExterna.parametros.map((p) => (p.campoVinculado ? kv(p.nome, p.campoVinculado) : esc(p.nome))))}` : null,
        ])}`
      );
    }
    if (dd.opcoesPredefinidas?.ativado) {
      dadosItems.push(
        `${kv("Opções predefinidas", "Ativado")}${subList([
          kv("Fonte", dd.opcoesPredefinidas.fonte ?? "não identificada"),
          kv("Consulta SQL configurada", sim(dd.opcoesPredefinidas.consultaConfigurada)),
          dd.opcoesPredefinidas.opcoesManuais ? `${esc("Opções manuais")}${subList(dd.opcoesPredefinidas.opcoesManuais.map((o) => kv(o.label, o.value)))}` : null,
        ])}`
      );
    } else {
      dadosItems.push(kv("Opções predefinidas", "Desativado"));
    }
    dadosItems.push(kv("Somente leitura", sim(dd.somenteLeitura)));
    const dados = h6("Dados", subList(dadosItems));

    const propriedadesEntries = Object.entries(detalhes.propriedades);
    const propriedades = propriedadesEntries.length > 0 ? h6("Propriedades", subList(propriedadesEntries.map(([k, v]) => kv(k, v)))) : "";
    const vinculos = detalhes.vinculos.length > 0 ? h6("Vínculos", subList(detalhes.vinculos.map((v) => esc(v)))) : "";

    return `${identidade}${basico}${multivalorado}${validacoes}${dados}${propriedades}${vinculos}`;
  }

  /** Renders one item as its own `<h5>` (campo) or `<h4>` (anything else — role-based, not
   *  depth-based, per explicit instruction), followed by its property groups as `<h6>` sections,
   *  then — for an agrupamento — its children right after, so a campo's h5 naturally reads as
   *  "belonging to" the componente h4 before it. */
  function itemHtml(item: ItemSpec): string {
    const level = item.categoria === "campo" ? h5Style : h4Style;
    const tag = item.categoria === "campo" ? "h5" : "h4";
    const heading = `<${tag} style="${level}">${esc(CATEGORIA_LABEL[item.categoria])}: ${esc(item.nome)}</${tag}>`;
    const totvs = item.integracaoTotvs && item.categoria !== "campo" ? [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".") : "";

    switch (item.categoria) {
      case "campo":
        return heading + (item.detalhes ? campoDetalhesHtml(item.detalhes) : "");
      case "texto": {
        const geral = subList([kv("Conteúdo", item.conteudoHtml ?? ""), item.classeCss ? kvCode("Classe CSS", item.classeCss) : null, logicaText(item.logica) ? kv("Lógica", logicaText(item.logica)!) : null]);
        return heading + h6("Geral", geral);
      }
      case "agrupamento": {
        const geral = subList([item.classeCss ? kvCode("Classe CSS", item.classeCss) : null, totvs ? kv("TOTVS", totvs) : null]);
        const config = item.larguraPorColuna
          ? `Componente com ${item.larguraPorColuna.length} coluna(s), largura(s): ${esc(item.larguraPorColuna.join(", "))}.`
          : item.numColunas
            ? `Componente com ${item.numColunas} elemento(s).`
            : null;
        const personalizacao = subList([
          config ? kv("Configuração", config) : null,
          item.padding ? kv("Padding", item.padding) : null,
          item.larguraMaxima ? kv("Largura máxima", item.larguraMaxima) : null,
          item.temBackground ? kv("Background", item.corBackground ? `cor ${item.corBackground}` : item.temImagemBackground ? "possui imagem" : "configurado") : null,
          item.cssCodigo ? `${esc("CSS")}<code style="${codeStyle}">${esc(item.cssCodigo)}</code>` : null,
        ]);
        const alinhamento = item.alinhamento ? subList([kv("Alinhamento", item.alinhamento)]) : "";
        const logicaVal = logicaText(item.logica);
        const logica = logicaVal ? subList([kv("Condição", logicaVal)]) : "";
        const filhos = (item.filhos ?? []).map(itemHtml).join("");
        return heading + h6("Geral", geral) + h6("Personalização", personalizacao) + h6("Alinhamento", alinhamento) + h6("Lógica", logica) + filhos;
      }
      case "botao": {
        const geral = subList([item.nomeComponente ? kv("Nome do componente", item.nomeComponente) : null, item.classeCss ? kvCode("Classe CSS", item.classeCss) : null]);
        const personalizacao = subList([
          kv("Título do botão", item.nome),
          kv("Tema do botão", item.tema ?? "padrão"),
          kv("Cor", `${item.corBotao ?? "padrão"}${item.usaCorInstitucional ? " (institucional)" : ""}`),
          kv("Cor do texto", item.corTexto ?? "padrão"),
          kv("Ícone", sim(item.temIcone)),
          kv("Escondido", sim(item.escondido)),
        ]);
        const primeiro = (item.acoesPrimeiroPlano ?? []).map(acaoHtml).join("");
        const segundo = (item.acoesSegundoPlano ?? []).map(acaoHtml).join("");
        const encaminhamentos = (item.encaminhamentos ?? []).map(encaminhamentoHtml).join("");
        const acoes =
          subList([kv("Salvar dados", sim(item.salvaDados))]) +
          (primeiro ? `<p style="${bodyStyle}"><strong>Primeiro plano (síncrono)</strong></p><ul style="${ulStyle}">${primeiro}</ul>` : "") +
          (segundo ? `<p style="${bodyStyle}"><strong>Segundo plano (assíncrono)</strong></p><ul style="${ulStyle}">${segundo}</ul>` : "") +
          subList([kv("Fechar pop-up", sim(item.fecharPopup))]) +
          `<p style="${bodyStyle}"><strong>Encaminhar usuário</strong></p>` +
          subList([kv("Redireciona", sim(item.redirecionaUsuario))]) +
          (encaminhamentos ? `<ul style="${ulStyle}">${encaminhamentos}</ul>` : "");
        return heading + h6("Geral", geral) + h6("Personalização", personalizacao) + h6("Ações", acoes);
      }
      case "cep": {
        const geral = subList([item.classeCss ? kvCode("Classe CSS", item.classeCss) : null]);
        const configuracao = subList([kv("Campo vinculado", item.campoCepVinculado ?? "(não identificado)"), kv("Editável", sim(item.editavel))]);
        return heading + h6("Geral", geral) + h6("Configuração", configuracao);
      }
      case "html": {
        const geral = subList([kv("Tipo", item.tipoHtml === "script" ? "Script" : "HTML"), item.classeCss ? kvCode("Classe CSS", item.classeCss) : null]);
        const conteudo = `<code style="${codeStyle}">${esc(item.conteudoHtml ?? "")}</code>`;
        return heading + h6("Geral", geral) + h6("Conteúdo", conteudo);
      }
      case "upload": {
        const geral = subList([item.classeCss ? kvCode("Classe CSS", item.classeCss) : null]);
        const alvos = (item.camposVinculadosUpload ?? []).map((a) => kv(a.papel, a.campo));
        const configuracao = subList([kv("Tamanho máximo", `${item.tamanhoMaximoMb ?? "?"}MB`), kv("Múltiplos arquivos", sim(item.multiplosArquivos)), ...alvos]);
        return heading + h6("Geral", geral) + h6("Configuração", configuracao);
      }
      default: {
        const geral = subList([kv("Tipo", item.tipo), item.classeCss ? kvCode("Classe CSS", item.classeCss) : null]);
        return heading + h6("Geral", geral);
      }
    }
  }

  const parts: string[] = [];
  parts.push(`<h1 style="${titleStyle}">${esc(doc.tituloPortal)}</h1>`);

  for (const etapa of doc.etapas) {
    parts.push(`<h2 style="${stageStyle}">Etapa: ${esc(etapa.nome)}</h2>`);
    parts.push(`<h4 style="${h4Style}">Lógica de exibição</h4>`);
    parts.push(`<p style="${bodyStyle}">${esc(etapa.logicaExibicao)}</p>`);
    parts.push(`<h4 style="${h4Style}">Descrição</h4>`);
    parts.push(`<p style="${bodyStyle}">${esc(etapa.descricao)}</p>`);

    if (etapa.fontesDados.length > 0) {
      parts.push(`<h4 style="${h4Style}">Fontes de dados</h4>`);
      parts.push(`<p style="${bodyStyle}">TOTVS/Rubeus: ${esc(etapa.fontesDados.join(", "))}</p>`);
    }

    etapa.passos.forEach((passo) => {
      parts.push(`<h3 style="${h3Style}">Passo: ${esc(passo.nome)}</h3>`);
      for (const item of passo.itens) parts.push(itemHtml(item));
    });

    if (etapa.feedbacks.length > 0) {
      parts.push(`<h4 style="${h4Style}">Feedbacks</h4>`);
      const items = etapa.feedbacks
        .map((f, i) => `<li style="${bodyStyle}">Feedback ${i + 1} (${esc(f.nome)})${f.conclusivo ? " <strong>[conclusivo]</strong>" : ""}: <strong>${esc(f.condicao)}</strong></li>`)
        .join("");
      parts.push(`<ul style="${ulStyle}">${items}</ul>`);
    }
  }

  return parts.join("\n");
}
