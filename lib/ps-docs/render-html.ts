import type { AcaoBotaoSpec, CampoDetalhado, ColunaDataserverSpec, ConsultaSqlSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, LogicaSpec, ParametroAcaoSpec, PopupSpec, PortalOverviewSpec, RegraLogicaItem, StyleConfig } from "./types";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A resolved field ref reads "Label (id)" (`formatFieldRef`) — bolds the whole thing, italicizing
 *  just the trailing "(id)" when present, e.g. `<strong>Label <em>(id)</em></strong>`, per explicit
 *  instruction. Falls back to bolding the whole string when there's no trailing "(id)" (unresolved
 *  fallbacks like "(campo não identificado)"). */
function fieldRefHtml(campo: string): string {
  const m = campo.match(/^(.+) (\(\d+\))$/);
  if (m) return `<strong>${esc(m[1])} <em>${esc(m[2])}</em></strong>`;
  return `<strong>${esc(campo)}</strong>`;
}


/** One condition, arrow-separated per explicit instruction ("ficha" format): campo → regra →
 *  valor, all three bold — valor omitted for rule ids that don't take one (É desconhecido/É
 *  conhecido). */
function logicaItemHtml(l: RegraLogicaItem): string {
  const valorHtml = l.valor !== undefined ? ` → <strong>${esc(l.valor)}</strong>` : "";
  return `${fieldRefHtml(l.campo)} → <strong>${esc(l.regra)}</strong>${valorHtml}`;
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
  const h6Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:10pt;font-weight:700;margin-top:8pt;`;
  const bodyStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.bodyColor};font-size:11pt;line-height:1.5;`;
  const codeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:8px;display:block;white-space:pre-wrap;`;
  const inlineCodeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:1px 4px;`;
  // Explicit list styling: the host page (Tailwind preflight) zeroes out `ul`/`ol` margin/padding
  // and sets `list-style:none` by default, which collapses raw `<ul><li>` markup into flat,
  // unindented text — this is what makes bullets/indentation show up regardless of the page's CSS.
  const ulStyle = `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`;
  const hrStyle = `border:none;border-top:1px solid rgba(127,127,127,0.3);margin:18pt 0;`;
  const hr = `<hr style="${hrStyle}">`;
  const h4Tag = `<h4 style="${h4Style}">`;

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

  /** Every mention of "Lógica"/"Condição" renders in the builder's own "ficha" format, per explicit
   *  instruction: a header line "Ação: X → Condição: Y" (the logic's own `action_logic_id`/
   *  `condition_logic_id`), followed by one nested bullet per rule. Returns a fragment meant to be
   *  used as ONE list item's content (nest it in `subList([...])` when it needs to be its own
   *  bullet under a heading, e.g. `h6("Lógica", subList([logicaSpecHtml(spec)]))`). */
  function logicaSpecHtml(spec: LogicaSpec | undefined): string {
    if (!spec || spec.regras.length === 0) return "";
    const header = `${esc("Ação")}: <strong>${esc(spec.acao ?? "não identificada")}</strong> → ${esc("Condição")}: <strong>${esc(spec.condicao ?? "não identificada")}</strong>`;
    return `${header}${subList(spec.regras.map(logicaItemHtml))}`;
  }

  /** An encaminhamento's "Destino" — a "Campo do sistema"/"Valor fixo" destino (Link externo) only
   *  bolds its own value, not the "Campo do sistema:"/"Valor fixo:" prefix (per explicit
   *  instruction: "Destino: Valor fixo: **URL**", not the whole string bold); every other destino
   *  kind (etapa/página/pop-up name, etc.) keeps the previous fully-bold `kv` rendering. */
  function destinoHtml(destino: string): string {
    for (const prefixo of ["Campo do sistema: ", "Valor fixo: "]) {
      if (destino.startsWith(prefixo)) return `${esc("Destino")}: ${esc(prefixo)}<strong>${esc(destino.slice(prefixo.length))}</strong>`;
    }
    return kv("Destino", destino);
  }

  /** codConsulta/codSistema/codColigada + cache/frequência + contexto — never lists the fields a
   *  query returns, only the query's own configuration. When unconfigured, renders nothing at all
   *  (per explicit instruction — the "Não há sentença SQL configurada" message is reserved for the
   *  etapa/passo's own "Fonte de dados" section, via `consultaSqlHtml`, not for a button ação). */
  function fonteDadosHtml(fonte: FonteDadosSpec): string {
    if (!fonte.configurada) return "";
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

  /** The real configured SQL query of an etapa/passo (`get-stage-querys`/`step/querys`) — same
   *  "Não há sentença SQL configurada" text as `fonteDadosHtml` when unconfigured; otherwise lists
   *  Coligada/Sistema/Consulta/Cache(+frequência)/Parâmetros, reusing `parametrosHtml`. */
  function consultaSqlHtml(titulo: string, consulta: ConsultaSqlSpec): string {
    if (!consulta.configurada) return `<h4 style="${h4Style}">${esc(titulo)}</h4><p style="${bodyStyle}">Não há sentença SQL configurada</p>`;
    return (
      `<h4 style="${h4Style}">${esc(titulo)}</h4>` +
      subList([
        kv("Coligada", consulta.codColigada),
        kv("Sistema", consulta.codSistema),
        kv("Consulta", consulta.codConsulta),
        kv("Cache", sim(consulta.usaCache)),
        consulta.usaCache ? kv("Frequência do cache", consulta.frequenciaCache ?? "não informada") : null,
        parametrosHtml(consulta.parametros),
      ])
    );
  }

  /** `label` is "Contexto" for Dataservers/Processos (Salvar dados/Executar processo) — every
   *  other action type calls this the same table "Parâmetros", per explicit instruction. */
  function parametrosHtml(parametros: ParametroAcaoSpec[], label = "Parâmetros"): string {
    return `${kv(label, sim(parametros.length > 0))}${subList(
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
    const condicao = logicaSpecHtml(acao.logica) || null;

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
      body = [kv("Dataserver", acao.dataserver ?? "não identificado"), acao.colunas ? colunasHtml(acao.colunas) : null, parametrosHtml(acao.parametros, "Contexto")];
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

    const children = subList([acao.mensagemErro ? kv("Mensagem de erro", acao.mensagemErro) : null, ...body, condicao]);
    const fonte = acao.fonteDados !== undefined ? fonteDadosHtml(acao.fonteDados) : "";
    return `<li style="${bodyStyle}">${header}${children}${fonte}</li>`;
  }

  /** A pop-up's own full config (`GET /api/popups/{id}`) — Nome/Permite fechar/Altura e Largura
   *  máxima, its own configured SQL query (`GET /api/popups/querys/{id}`, same shape as a
   *  stage/step's own), then its `content` rendered exactly like a passo's own items (starting
   *  fresh at depth 0, since a pop-up is a self-contained screen), per explicit instruction. */
  function popupHtml(popup: PopupSpec): string {
    const config = subList([
      kv("Nome", popup.nome),
      kv("Permite fechar", sim(popup.permiteFechar)),
      kv("Altura máxima", popup.alturaMaxima ?? "Altura máxima não definida"),
      kv("Largura máxima", popup.larguraMaxima ?? "Largura máxima não definida"),
    ]);
    const fonteDados = consultaSqlHtml("Fonte de dados do pop-up", popup.consultaSql);
    const conteudo = popup.itens.map((item) => itemHtml(item, 0)).join("");
    return `${esc("Pop-up")}${config}${fonteDados}${conteudo}`;
  }

  function encaminhamentoHtml(enc: EncaminhamentoSpec): string {
    const condicao = logicaSpecHtml(enc.logica) || null;
    const destino = enc.destino !== enc.tipo ? `${destinoHtml(enc.destino)}${enc.novaAba ? " (nova aba)" : ""}` : enc.novaAba ? kv("Nova aba", "Sim") : "";
    const popup = enc.popupDetalhe ? popupHtml(enc.popupDetalhe) : null;
    return `<li style="${bodyStyle}">${kv("Tipo", enc.tipo)}${subList([destino || null, enc.parametros && enc.parametros.length > 0 ? parametrosHtml(enc.parametros) : null, condicao, popup])}</li>`;
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

  /** Renders one item as its own heading — depth-based, per explicit instruction: a top-level item
   *  (direct child of a passo) is `<h4>`, an item nested one level inside another component (e.g. a
   *  field/component inside an agrupamento) is `<h5>`, and anything deeper is `<h6>` (the deepest
   *  level named here — capped there rather than growing past it) — followed by its own property
   *  groups (still fixed `<h6>` sections, e.g. "Geral"/"Personalização"), then — for an agrupamento
   *  — its children right after, one depth level deeper. */
  function itemHtml(item: ItemSpec, depth = 0): string {
    const [level, tag] = depth <= 0 ? [h4Style, "h4"] : depth === 1 ? [h5Style, "h5"] : [h6Style, "h6"];
    const heading = `<${tag} style="${level}">${esc(CATEGORIA_LABEL[item.categoria])}: ${esc(item.nome)}</${tag}>`;
    const totvs = item.integracaoTotvs && item.categoria !== "campo" ? [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".") : "";

    switch (item.categoria) {
      case "campo":
        return heading + (item.detalhes ? campoDetalhesHtml(item.detalhes) : "");
      case "texto": {
        const geral = subList([
          kv("Conteúdo", item.conteudoHtml ?? ""),
          item.classeCss ? kvCode("Classe CSS", item.classeCss) : null,
          logicaSpecHtml(item.logica) || null,
        ]);
        return heading + h6("Geral", geral);
      }
      case "agrupamento": {
        const geral = subList([
          item.classeCss ? kvCode("Classe CSS", item.classeCss) : null,
          totvs ? kv("TOTVS", totvs) : null,
          item.cssCodigo ? `${esc("CSS")}<code style="${codeStyle}">${esc(item.cssCodigo)}</code>` : null,
        ]);
        const campos =
          item.camposAgrupados && item.camposAgrupados.length > 0
            ? subList(
                item.camposAgrupados.map(
                  (c) => `${fieldRefHtml(c.nome)}${c.logica ? subList([logicaSpecHtml(c.logica)]) : ""}`
                )
              )
            : "";
        const background = item.background
          ? `${esc("Background")}${subList([
              item.background.tipo ? kv("Tipo", item.background.tipo) : null,
              item.background.cor ? kv("Cor", item.background.cor) : null,
              item.background.possuiImagemVinculada ? kv("Possui imagem vinculada", "Sim") : null,
            ])}`
          : null;
        const personalizacao = subList([item.padding ? kv("Padding", item.padding) : null, item.larguraMaxima ? kv("Largura máxima", item.larguraMaxima) : null, background]);
        const alinhamento = item.alinhamento
          ? subList([
              item.alinhamento.direcao ? kv("Direção", item.alinhamento.direcao) : null,
              item.alinhamento.horizontal ? kv("Alinhamento horizontal", item.alinhamento.horizontal) : null,
              item.alinhamento.vertical ? kv("Alinhamento vertical", item.alinhamento.vertical) : null,
            ])
          : "";
        const logica = item.logica ? subList([logicaSpecHtml(item.logica)]) : "";
        const filhos = (item.filhos ?? []).map((child) => itemHtml(child, depth + 1)).join("");
        return heading + h6("Geral", geral) + h6("Conteúdo", campos) + h6("Personalização", personalizacao) + h6("Alinhamento", alinhamento) + h6("Lógica", logica) + filhos;
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
    parts.push(etapa.logicaExibicao.regras.length > 0 ? subList([logicaSpecHtml(etapa.logicaExibicao)]) : `<p style="${bodyStyle}">Nenhuma restrição de exibição identificada.</p>`);
    parts.push(`<h4 style="${h4Style}">Descrição</h4>`);
    parts.push(`<p style="${bodyStyle}">${esc(etapa.descricao)}</p>`);

    parts.push(consultaSqlHtml("Fonte de dados da etapa", etapa.consultaSql));

    etapa.passos.forEach((passo) => {
      parts.push(`<h3 style="${h3Style}">Passo: ${esc(passo.nome)}</h3>`);
      parts.push(consultaSqlHtml("Fonte de dados do passo", passo.consultaSql));
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

  // Divide between h4-level blocks with a horizontal rule, per explicit instruction — inserted as
  // a post-processing pass (every h4 in the document shares this exact opening tag, regardless of
  // which section produced it) rather than at each individual push site, since h4 headings are
  // emitted from several different places (etapa fields, `consultaSqlHtml`, item headings). Not
  // shown directly under a title (h1/h2/h3) or at the very start of the document — only between two
  // actual h4 blocks.
  let html = parts.join("\n");
  html = html.split(h4Tag).join(`${hr}${h4Tag}`);
  for (const closer of ["</h1>", "</h2>", "</h3>"]) html = html.split(`${closer}\n${hr}`).join(closer);
  if (html.startsWith(hr)) html = html.slice(hr.length);
  return html;
}

/** Standalone version of the campo-detail block used inside `renderDocumentHtml`'s `itemHtml` —
 *  duplicated (not shared) because that one lives as a closure over `style` inside
 *  `renderDocumentHtml`; this one is used to describe a single field outside of any etapa/passo
 *  tree (the portal-level "Geral" section's `campoOfertaCurso`/`campoLocalOferta`), per explicit
 *  instruction to document those "como já é feita hoje" (same shape as a normal campo). */
export function renderCampoDetalhadoHtml(detalhes: CampoDetalhado, style: StyleConfig): string {
  const h6Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:10pt;font-weight:700;margin-top:8pt;`;
  const bodyStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.bodyColor};font-size:11pt;line-height:1.5;`;
  const codeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:8px;display:block;white-space:pre-wrap;`;
  const inlineCodeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:1px 4px;`;
  const ulStyle = `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`;
  const sim = (v: boolean | undefined) => (v ? "Sim" : "Não");
  const kv = (label: string, value: string) => `${esc(label)}: <strong>${esc(value)}</strong>`;
  const kvCode = (label: string, value: string) => `${esc(label)}: <code style="${inlineCodeStyle}">${esc(value)}</code>`;

  function subList(items: (string | null | undefined | false)[]): string {
    const filtered = items.filter((i): i is string => !!i);
    return filtered.length > 0 ? `<ul style="${ulStyle}">${filtered.map((i) => `<li style="${bodyStyle}">${i}</li>`).join("")}</ul>` : "";
  }
  function h6(title: string, innerHtml: string): string {
    if (!innerHtml) return "";
    return `<h6 style="${h6Style}">${esc(title)}</h6>${innerHtml}`;
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

/** Renders the "PortalOverview" documentation (Geral/Consultas/Scripts/Integrações/Segurança/
 *  Domínio/TOTVS) as styled HTML — same styling convention as `renderDocumentHtml`, used for both
 *  the on-screen preview and the .docx/.md/clipboard exports of the portal-level section. */
export function renderPortalOverviewHtml(overview: PortalOverviewSpec, style: StyleConfig): string {
  const titleStyle = `font-family:'${style.titleFont}',sans-serif;color:${style.titleColor};font-size:26pt;font-weight:900;`;
  const h3Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:13pt;font-weight:700;margin-top:20pt;`;
  const h4Style = `font-family:'${style.bodyFont}',sans-serif;color:${style.subheadingColor};font-size:12pt;font-weight:700;margin-top:14pt;`;
  const bodyStyle = `font-family:'${style.bodyFont}',sans-serif;color:${style.bodyColor};font-size:11pt;line-height:1.5;`;
  const codeStyle = `font-family:monospace;font-size:9.5pt;background:rgba(127,127,127,0.12);padding:8px;display:block;white-space:pre-wrap;`;
  const ulStyle = `margin:2px 0 8px 0;padding-left:22px;list-style-type:disc;`;
  const sim = (v: boolean | undefined) => (v ? "Sim" : "Não");
  const kv = (label: string, value: string) => `${esc(label)}: <strong>${esc(value)}</strong>`;

  function subList(items: (string | null | undefined | false)[]): string {
    const filtered = items.filter((i): i is string => !!i);
    return filtered.length > 0 ? `<ul style="${ulStyle}">${filtered.map((i) => `<li style="${bodyStyle}">${i}</li>`).join("")}</ul>` : "";
  }

  const parts: string[] = [];
  const { geral, consultas, scripts, integracoes, seguranca, dominio, totvs } = overview;

  parts.push(`<h1 style="${titleStyle}">${esc(geral.nome)}</h1>`);

  parts.push(`<h2 style="${h3Style}">Geral</h2>`);
  parts.push(
    subList([
      kv("Título", geral.titulo),
      kv("Ativo", sim(geral.ativo)),
      geral.paginaEdicaoInscricao ? kv("Página de edição da inscrição", geral.paginaEdicaoInscricao.nome) : null,
      geral.paginaDetalhesUsuario ? kv("Página de detalhes do usuário", geral.paginaDetalhesUsuario.nome) : null,
      kv("Carregamento inteligente", sim(geral.carregamentoInteligente)),
      kv("VLibras ativo", sim(geral.vlibrasAtivo)),
      kv("Cabeçalho ativo", sim(geral.cabecalhoAtivo)),
      geral.cabecalhoAtivo && geral.cabecalhoTexto ? kv("Texto do cabeçalho", geral.cabecalhoTexto) : null,
      geral.linkLogoff ? kv("Link de logoff", geral.linkLogoff) : null,
      kv("Título do select de inscrições", geral.tituloSelectInscricoes),
      kv("Título da barra de etapas", geral.tituloBarraEtapas),
      kv("Título da barra do portal do inscrito", geral.tituloBarraPortalInscrito),
    ])
  );

  if (geral.popupLgpd) {
    parts.push(`<h4 style="${h4Style}">Pop-up LGPD</h4>`);
    parts.push(subList([kv("Nome", geral.popupLgpd.nome), kv("Permite fechar", sim(geral.popupLgpd.permiteFechar))]));
  }
  if (geral.campoRegistro) {
    parts.push(`<h4 style="${h4Style}">Campo de código do registro</h4>`);
    parts.push(subList([kv("Campo", geral.campoRegistro.nome)]));
  }
  if (geral.campoOfertaCurso) {
    parts.push(`<h4 style="${h4Style}">Campo de oferta de curso</h4>`);
    parts.push(renderCampoDetalhadoHtml(geral.campoOfertaCurso.detalhes, style));
  }
  if (geral.campoLocalOferta) {
    parts.push(`<h4 style="${h4Style}">Campo de local de oferta</h4>`);
    parts.push(renderCampoDetalhadoHtml(geral.campoLocalOferta.detalhes, style));
  }

  parts.push(`<h2 style="${h3Style}">Consultas TOTVS</h2>`);
  if (consultas.length === 0) parts.push(`<p style="${bodyStyle}">Nenhuma consulta configurada.</p>`);
  for (const c of consultas) {
    parts.push(`<h4 style="${h4Style}">${esc(c.codigo)} — ${esc(c.descricao)}</h4>`);
    parts.push(
      subList([
        kv("Coligada", c.coligada),
        kv("Sistema", c.sistema),
        kv("Ativa", sim(c.ativa)),
        kv("Cache", sim(c.usaCache)),
        c.usaCache ? kv("Frequência do cache", c.frequenciaCache ?? "não informada") : null,
        c.contexto && c.contexto.length > 0 ? `${esc("Contexto")}${subList(c.contexto.map((ctx) => (ctx.campoVinculado ? kv(ctx.nome, ctx.campoVinculado) : esc(ctx.nome))))}` : null,
        // Mesmo formato de `parametrosHtml` (usado nas Fontes de dados de etapa/passo e na ação
        // "Realizar consulta" do botão): "Parâmetros: Sim" seguido de um item por parâmetro —
        // "NOME - Tipo" e, aninhado, "Campo do sistema: **label (id)**"/"Valor fixo: **valor**".
        `${kv("Parâmetros", sim(c.parametros.length > 0))}${subList(
          c.parametros.map(
            (p) =>
              `${esc(p.nome)} - ${esc(p.tipo)}${subList([
                p.tipo === "Campo do sistema" && p.campoSistema ? kv("Campo do sistema", p.campoSistema) : null,
                p.tipo === "Valor fixo" && p.valorFixo !== undefined ? kv("Valor fixo", p.valorFixo) : null,
              ])}`
          )
        )}`,
      ])
    );
  }
  parts.push(`<h2 style="${h3Style}">Scripts</h2>`);
  parts.push(
    subList([
      scripts.gtagCode ? kv("Tag do Google Analytics", scripts.gtagCode) : null,
      kv("Script do Head usa cookies", sim(scripts.scriptHeadComCookies)),
      kv("Script do Body usa cookies", sim(scripts.scriptBodyComCookies)),
    ])
  );
  if (scripts.scriptHead) parts.push(`<p style="${bodyStyle}"><strong>Script (Head)</strong></p><code style="${codeStyle}">${esc(scripts.scriptHead)}</code>`);
  if (scripts.scriptBody) parts.push(`<p style="${bodyStyle}"><strong>Script (Body)</strong></p><code style="${codeStyle}">${esc(scripts.scriptBody)}</code>`);

  parts.push(`<h2 style="${h3Style}">Integrações</h2>`);
  parts.push(`<p style="${bodyStyle}">Consultas vinculadas ao portal a partir do app Integração TOTVS, na ordem configurada.</p>`);
  if (integracoes.length === 0) parts.push(`<p style="${bodyStyle}">Nenhuma integração configurada.</p>`);
  for (const i of integracoes) {
    parts.push(`<h4 style="${h4Style}">[${i.posicao}] ${esc(i.query)} — ${esc(i.descricao)}</h4>`);
    parts.push(subList([kv("Coligada", i.coligada), kv("Sistema", i.sistema), i.tbc ? kv("TBC", i.tbc) : null, kv("Código externo (Integração TOTVS)", i.codigoExterno)]));
  }

  parts.push(`<h2 style="${h3Style}">Segurança</h2>`);
  parts.push(seguranca.length > 0 ? subList(seguranca.map((s) => kv(s.label, s.tipo))) : `<p style="${bodyStyle}">Nenhum campo de login configurado.</p>`);

  parts.push(`<h2 style="${h3Style}">Domínio</h2>`);
  parts.push(
    dominio
      ? subList([
          kv("Tipo", dominio.tipo === "sistema" ? "Domínio fornecido pelo sistema" : "Domínio próprio"),
          dominio.tipo === "sistema" ? kv("Domínio do sistema", dominio.dominioSistema) : kv("Domínio próprio", dominio.dominioProprio),
        ])
      : `<p style="${bodyStyle}">Domínio não configurado.</p>`
  );

  parts.push(`<h2 style="${h3Style}">TOTVS</h2>`);
  parts.push(
    subList([
      kv("TBC", totvs.tbc),
      kv("Usuário", totvs.usuario),
      kv("Coligada", totvs.codColigada),
      kv("Filial", totvs.codFilial),
      kv("Sistema", totvs.codSistema),
      kv("Tipo de curso", totvs.codTipoCurso),
    ])
  );

  if (overview.warnings.length > 0) {
    parts.push(`<h2 style="${h3Style}">Avisos</h2>`);
    parts.push(subList(overview.warnings));
  }

  return parts.join("\n");
}
