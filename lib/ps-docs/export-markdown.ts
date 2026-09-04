import type { AcaoBotaoSpec, CampoDetalhado, ColunaDataserverSpec, ConsultaSqlSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, LogicaSpec, ParametroAcaoSpec, PopupSpec, RegraLogicaItem } from "./types";

const sim = (v: boolean | undefined) => (v ? "Sim" : "Não");

/** Base indent for everything that sits directly under a heading (h4/h5/h6) — the "recuo à
 *  direita" that visually shows the bullets are grouped under the heading above them. Deeper
 *  nesting just concatenates two more spaces per level, same as before. */
const BASE = "  ";

/** "- Label: **value**" — the highlighted-value bullet format used everywhere. */
const kv = (indent: string, label: string, value: string) => `${indent}- ${label}: **${value}**`;
const kvCode = (indent: string, label: string, value: string) => `${indent}- ${label}: \`${value}\``;

/** A resolved field ref reads "Label (id)" (`formatFieldRef`) — bolds the whole thing, italicizing
 *  just the trailing "(id)" when present, e.g. `**Label *(id)***`, per explicit instruction. Falls
 *  back to bolding the whole string when there's no trailing "(id)" (unresolved fallbacks like
 *  "(campo não identificado)"). */
function fieldRefMd(campo: string): string {
  const m = campo.match(/^(.+) (\(\d+\))$/);
  if (m) return `**${m[1]} *${m[2]}***`;
  return `**${campo}**`;
}

/** One condition, arrow-separated per explicit instruction ("ficha" format): campo → regra →
 *  valor, all three bold — valor omitted for rule ids that don't take one (É desconhecido/É
 *  conhecido). */
function logicaItemText(l: RegraLogicaItem): string {
  return `${fieldRefMd(l.campo)} → **${l.regra}**${l.valor !== undefined ? ` → **${l.valor}**` : ""}`;
}

/** Every mention of "Lógica"/"Condição" renders in the builder's own "ficha" format, per explicit
 *  instruction: a header line "Ação: X → Condição: Y" (the logic's own `action_logic_id`/
 *  `condition_logic_id`), followed by one nested bullet per rule. */
function logicaSpecLines(spec: LogicaSpec | undefined, indent: string): string[] {
  if (!spec || spec.regras.length === 0) return [];
  return [`${indent}- Ação: **${spec.acao ?? "não identificada"}** → Condição: **${spec.condicao ?? "não identificada"}**`, ...spec.regras.map((l) => `${indent}  - ${logicaItemText(l)}`)];
}

/** An encaminhamento's "Destino" — a "Campo do sistema"/"Valor fixo" destino (Link externo) only
 *  bolds its own value, not the "Campo do sistema:"/"Valor fixo:" prefix (per explicit
 *  instruction); every other destino kind (etapa/página/pop-up name, etc.) keeps the previous
 *  fully-bold `kv` rendering. */
function destinoLine(indent: string, destino: string, suffix: string): string {
  for (const prefixo of ["Campo do sistema: ", "Valor fixo: "]) {
    if (destino.startsWith(prefixo)) return `${indent}- Destino: ${prefixo}**${destino.slice(prefixo.length)}**${suffix}`;
  }
  return kv(indent, "Destino", `${destino}${suffix}`);
}

/** codConsulta/codSistema/codColigada + cache/frequência + contexto — never lists the fields a
 *  query returns, only the query's own configuration (per explicit instruction). `indent` is the
 *  level this whole block starts at (passed in by the caller, already includes `BASE`). When
 *  unconfigured, renders nothing at all — the "Não há sentença SQL configurada" message is
 *  reserved for the etapa/passo's own "Fonte de dados" section, via `consultaSqlLines`, not for a
 *  button ação. */
function fonteDadosLines(fonte: FonteDadosSpec, indent: string): string[] {
  if (!fonte.configurada) return [];
  const temContexto = fonte.contexto.length > 0;
  const lines = [
    `${indent}- Fonte de dados:`,
    kv(indent + "  ", "Coligada", fonte.codColigada),
    kv(indent + "  ", "Sistema", fonte.codSistema),
    kv(indent + "  ", "Consulta", fonte.codConsulta),
    kv(indent + "  ", "Cache", sim(fonte.usaCache)),
  ];
  if (fonte.usaCache) lines.push(kv(indent + "  ", "Frequência do cache", fonte.frequenciaCache ?? "não informada"));
  lines.push(kv(indent + "  ", "Contexto", sim(temContexto)));
  if (temContexto) {
    lines.push(`${indent}    - Parâmetros do contexto:`);
    for (const c of fonte.contexto) lines.push(c.campoVinculado ? kv(indent + "      ", c.nome, c.campoVinculado) : `${indent}      - ${c.nome}`);
  }
  return lines;
}

/** The real configured SQL query of an etapa/passo (`get-stage-querys`/`step/querys`). */
function consultaSqlLines(titulo: string, consulta: ConsultaSqlSpec): string[] {
  if (!consulta.configurada) return [`#### ${titulo}`, "", "Não há sentença SQL configurada", ""];
  const lines = [
    `#### ${titulo}`,
    "",
    kv(BASE, "Coligada", consulta.codColigada),
    kv(BASE, "Sistema", consulta.codSistema),
    kv(BASE, "Consulta", consulta.codConsulta),
    kv(BASE, "Cache", sim(consulta.usaCache)),
  ];
  if (consulta.usaCache) lines.push(kv(BASE, "Frequência do cache", consulta.frequenciaCache ?? "não informada"));
  lines.push(...parametroLines(consulta.parametros, BASE));
  lines.push("");
  return lines;
}

/** `label` is "Contexto" for Dataservers/Processos (Salvar dados/Executar processo) — every other
 *  action type calls this the same table "Parâmetros", per explicit instruction. */
function parametroLines(parametros: ParametroAcaoSpec[], indent: string, label = "Parâmetros"): string[] {
  const lines = [kv(indent, label, sim(parametros.length > 0))];
  for (const p of parametros) {
    lines.push(`${indent}  - ${p.nome} - ${p.tipo}`);
    if (p.tipo === "Campo do sistema" && p.campoSistema) lines.push(kv(indent + "    ", "Campo do sistema", p.campoSistema));
    if (p.tipo === "Valor fixo" && p.valorFixo !== undefined) lines.push(kv(indent + "    ", "Valor fixo", p.valorFixo));
  }
  return lines;
}

function colunasLines(colunas: ColunaDataserverSpec[], indent: string): string[] {
  if (colunas.length === 0) return [];
  const lines = [`${indent}- Colunas:`];
  for (const c of colunas) lines.push(kv(indent + "  ", `${c.coluna}${c.tabela ? ` (${c.tabela})` : ""}`, c.correspondente));
  return lines;
}

/** Renders one action per the user's exact target format — the fields shown depend on
 *  `tipoAcao`: Realizar Consulta shows its own código/campos vinculados/parâmetros (and NO Fonte
 *  de dados block, since that's already this); Salvar Dados/Executar processo show the
 *  dataserver + Coluna/Tabela/Correspondente table; Ação Rubeus shows campos configurados +
 *  eventos + pessoa vinculada, no parâmetros table. */
function acaoLines(acao: AcaoBotaoSpec, indent: string): string[] {
  const lines = [`${indent}- [${acao.ordem}] Tipo da ação: **${acao.tipoAcao}**${acao.ativada ? "" : " **[desativada]**"}`];
  const body = indent + "  ";
  lines.push(kv(body, "Descrição", acao.descricao));
  if (acao.mensagemErro) lines.push(kv(body, "Mensagem de erro", acao.mensagemErro));

  if (acao.tipoAcao === "Realizar consulta") {
    lines.push(kv(body, "Código da consulta", acao.acaoParametrizada ?? "não identificado"));
    lines.push(kv(body + "  ", "Possui campo vinculado", sim(acao.camposConfigurados.length > 0)));
    if (acao.camposConfigurados.length > 0) {
      lines.push(`${body}    - Campos:`);
      acao.camposConfigurados.forEach((c) => lines.push(`${body}      - ${c}`));
    }
    lines.push(...parametroLines(acao.parametros, body + "  "));
  } else if (acao.tipoAcao === "Salvar dados" || acao.tipoAcao === "Executar processo") {
    lines.push(kv(body, "Dataserver", acao.dataserver ?? "não identificado"));
    if (acao.colunas) lines.push(...colunasLines(acao.colunas, body));
    lines.push(...parametroLines(acao.parametros, body, "Contexto"));
  } else if (acao.tipoAcao === "Ação Rubeus") {
    if (acao.camposConfigurados.length > 0) {
      lines.push(`${body}- Campos configurados:`);
      acao.camposConfigurados.forEach((c) => lines.push(`${body}  - ${c}`));
    }
    if (acao.eventos && acao.eventos.length > 0) {
      lines.push(`${body}- Eventos:`);
      acao.eventos.forEach((e) => lines.push(`${body}    - **${e.codigo} - ${e.descricao ?? "(evento não identificado)"}**`));
    }
    if (acao.pessoaVinculada) {
      lines.push(`${body}- Pessoa vinculada:`);
      lines.push(kv(body + "  ", "Identificador do contato", acao.pessoaVinculada.identificadorContato ?? "não informado"));
      if (acao.pessoaVinculada.tipoContato) lines.push(kv(body + "  ", "Tipo do contato", acao.pessoaVinculada.tipoContato));
      lines.push(kv(body + "  ", "Altera contato principal", sim(acao.pessoaVinculada.alterarContatoPrincipal)));
    }
  } else {
    if (acao.camposConfigurados.length > 0) {
      lines.push(`${body}- Campos configurados:`);
      acao.camposConfigurados.forEach((c) => lines.push(`${body}  - ${c}`));
    }
    lines.push(...parametroLines(acao.parametros, body));
  }

  lines.push(...logicaSpecLines(acao.logica, body));

  if (acao.fonteDados !== undefined) lines.push(...fonteDadosLines(acao.fonteDados, body));

  return lines;
}

/** A pop-up's own full config (`GET /api/popups/{id}`) — Nome/Permite fechar/Altura e Largura
 *  máxima, its own configured SQL query (`GET /api/popups/querys/{id}`, same shape as a
 *  stage/step's own — rendered as nested bullets here, not a `####` heading like
 *  `consultaSqlLines`, since this whole block already sits nested inside an encaminhamento's own
 *  indent), then its `content` rendered exactly like a passo's own items (starting fresh at depth
 *  0, since a pop-up is a self-contained screen), per explicit instruction. */
function popupLines(popup: PopupSpec, indent: string): string[] {
  const inner = indent + "  ";
  const lines = [
    `${indent}- Pop-up:`,
    kv(inner, "Nome", popup.nome),
    kv(inner, "Permite fechar", sim(popup.permiteFechar)),
    kv(inner, "Altura máxima", popup.alturaMaxima ?? "Altura máxima não definida"),
    kv(inner, "Largura máxima", popup.larguraMaxima ?? "Largura máxima não definida"),
  ];
  const consulta = popup.consultaSql;
  if (!consulta.configurada) {
    lines.push(`${inner}- Fonte de dados do pop-up: **Não há sentença SQL configurada**`);
  } else {
    lines.push(`${inner}- Fonte de dados do pop-up:`);
    lines.push(kv(inner + "  ", "Coligada", consulta.codColigada));
    lines.push(kv(inner + "  ", "Sistema", consulta.codSistema));
    lines.push(kv(inner + "  ", "Consulta", consulta.codConsulta));
    lines.push(kv(inner + "  ", "Cache", sim(consulta.usaCache)));
    if (consulta.usaCache) lines.push(kv(inner + "  ", "Frequência do cache", consulta.frequenciaCache ?? "não informada"));
    lines.push(...parametroLines(consulta.parametros, inner + "  "));
  }
  for (const item of popup.itens) renderItem(item, lines, 0);
  return lines;
}

function encaminhamentoLines(enc: EncaminhamentoSpec, indent: string): string[] {
  const lines = [kv(indent, "Tipo", enc.tipo)];
  if (enc.destino !== enc.tipo) lines.push(destinoLine(indent, enc.destino, enc.novaAba ? " (nova aba)" : ""));
  else if (enc.novaAba) lines.push(kv(indent, "Nova aba", "Sim"));
  if (enc.parametros && enc.parametros.length > 0) lines.push(...parametroLines(enc.parametros, indent));
  lines.push(...logicaSpecLines(enc.logica, indent + "  "));
  if (enc.popupDetalhe) lines.push(...popupLines(enc.popupDetalhe, indent));
  return lines;
}

function validacaoLines(detalhes: CampoDetalhado): string[] {
  const lines: string[] = [];
  for (const v of detalhes.validacoes) {
    const isRegex = v.tipo.toLowerCase().includes("regular");
    lines.push(kv(BASE, v.tipo, sim(v.ativado)));
    if (v.mensagem) lines.push(kv(BASE + "  ", "Mensagem", v.mensagem));
    if (v.valor) lines.push(isRegex ? kvCode(BASE + "  ", "Valor", v.valor) : kv(BASE + "  ", "Valor", v.valor));
    if (v.inverter !== undefined) lines.push(kv(BASE + "  ", "Inverter", sim(v.inverter)));
    if (v.codigo) {
      lines.push(`${BASE}  - Código:`);
      lines.push(`${BASE}    \`\`\``);
      lines.push(`${BASE}    ${v.codigo.split("\n").join(`\n${BASE}    `)}`);
      lines.push(`${BASE}    \`\`\``);
    }
  }
  return lines;
}

/** A campo's own detail — Identificação/Básico/Multivalorado/Validação/Dados/Propriedades/
 *  Vínculos, each its own `######` (h6) heading, with the key/value bullets indented (`BASE`)
 *  underneath so they read as grouped under that heading. */
function campoDetalhesBlock(detalhes: CampoDetalhado, out: string[]): void {
  const id = detalhes.identidade;
  const b = detalhes.basico;
  const dd = detalhes.dados;

  out.push("###### Identificação", "");
  out.push(kv(BASE, "Tipo", id.tipoCampo));
  if (id.tabelaProcessoSeletivo) out.push(kv(BASE, "Tabela do processo seletivo", id.tabelaProcessoSeletivo));
  out.push(kv(BASE, "Multivalorado", sim(id.multivalorado)));
  if (id.integracaoRubeus) {
    out.push(kv(BASE, "Integração Rubeus", sim(id.integracaoRubeus.ativada)));
    if (id.integracaoRubeus.ativada) out.push(kv(BASE + "  ", "Tabela | Coluna", `${id.integracaoRubeus.tabela ?? ""} | ${id.integracaoRubeus.coluna ?? ""}`));
  }
  if (id.integracaoTotvs) {
    out.push(kv(BASE, "Integração TOTVS", sim(id.integracaoTotvs.ativada)));
    if (id.integracaoTotvs.ativada) {
      out.push(kv(BASE + "  ", "Tabela.Campo", `${id.integracaoTotvs.tabela ?? ""}.${id.integracaoTotvs.campo ?? ""}`));
      if (id.integracaoTotvs.nomeAlternativo) out.push(kv(BASE + "  ", "Nome alternativo", id.integracaoTotvs.nomeAlternativo));
    }
  }
  out.push("");

  out.push("###### Básico", "");
  const basicoEntries: [string, string | undefined, boolean?][] = [
    ["Rótulo", b.rotulo],
    ["Placeholder", b.placeholder],
    ["Posição do rótulo", b.posicaoRotulo],
    ["Transformar texto", b.transformarTexto],
    ["Descrição", b.descricao],
    ["Dica", b.dica],
    ["Máscara", b.mascara],
    ["Sufixo", b.sufixo],
    ["Prefixo", b.prefixo],
    ["Classe CSS", b.classeCss, true],
  ];
  for (const [label, value, code] of basicoEntries) if (value) out.push(code ? kvCode(BASE, label, value) : kv(BASE, label, value));
  out.push(kv(BASE, "Desabilitar", sim(b.desabilitar)));
  out.push(kv(BASE, "Esconder", sim(b.esconder)));
  out.push(kv(BASE, "Esconder rótulo", sim(b.esconderRotulo)));
  out.push("");

  if (detalhes.multivalorado) {
    out.push("###### Multivalorado", "");
    if (detalhes.multivalorado.minOpcoes != null) out.push(kv(BASE, "Mínimo de opções", String(detalhes.multivalorado.minOpcoes)));
    if (detalhes.multivalorado.maxOpcoes != null) out.push(kv(BASE, "Máximo de opções", String(detalhes.multivalorado.maxOpcoes)));
    out.push("");
  }

  if (detalhes.validacoes.length > 0) {
    out.push("###### Validação", "");
    out.push(...validacaoLines(detalhes));
    out.push("");
  }

  out.push("###### Dados", "");
  if (dd.tipoValorPadrao) out.push(kv(BASE, `Valor padrão (${dd.tipoValorPadrao})`, dd.valorPadrao ?? ""));
  if (dd.fonteExterna) {
    out.push(`${BASE}- Fonte externa:`);
    out.push(kv(BASE + "  ", "Tipo de envio", dd.fonteExterna.tipoEnvio ?? "não informado"));
    out.push(kv(BASE + "  ", "Link", dd.fonteExterna.link ?? "não informado"));
    out.push(kv(BASE + "  ", "Salva automaticamente", sim(dd.fonteExterna.salvaAutomaticamente)));
    out.push(kv(BASE + "  ", "Envia parâmetros", sim(dd.fonteExterna.enviaParametros)));
    if (dd.fonteExterna.parametros.length > 0) {
      out.push(`${BASE}  - Parâmetros:`);
      for (const p of dd.fonteExterna.parametros) out.push(p.campoVinculado ? kv(BASE + "    ", p.nome, p.campoVinculado) : `${BASE}    - ${p.nome}`);
    }
  }
  if (dd.opcoesPredefinidas?.ativado) {
    out.push(kv(BASE, "Opções predefinidas", "Ativado"));
    out.push(kv(BASE + "  ", "Fonte", dd.opcoesPredefinidas.fonte ?? "não identificada"));
    out.push(kv(BASE + "  ", "Consulta SQL configurada", sim(dd.opcoesPredefinidas.consultaConfigurada)));
    if (dd.opcoesPredefinidas.opcoesManuais) {
      out.push(`${BASE}  - Opções manuais:`);
      for (const o of dd.opcoesPredefinidas.opcoesManuais) out.push(kv(BASE + "    ", o.label, o.value));
    }
  } else {
    out.push(kv(BASE, "Opções predefinidas", "Desativado"));
  }
  out.push(kv(BASE, "Somente leitura", sim(dd.somenteLeitura)));
  out.push("");

  const propriedadesEntries = Object.entries(detalhes.propriedades);
  if (propriedadesEntries.length > 0) {
    out.push("###### Propriedades", "");
    for (const [k, v] of propriedadesEntries) out.push(kv(BASE, k, v));
    out.push("");
  }
  if (detalhes.vinculos.length > 0) {
    out.push("###### Vínculos", "");
    for (const v of detalhes.vinculos) out.push(`${BASE}- ${v}`);
    out.push("");
  }
}

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

/** Renders one item's heading — depth-based, per explicit instruction: a top-level item (direct
 *  child of a passo) is `####` (h4), an item nested one level inside another component is `#####`
 *  (h5), and anything deeper is `######` (h6 — the deepest level named here, capped there rather
 *  than growing past it) — followed by its own property groups (still fixed `######` sections),
 *  every bullet indented (`BASE`) under its heading, then — for an agrupamento — its children
 *  rendered the same way right after, one depth level deeper. */
function renderItem(item: ItemSpec, out: string[], depth = 0): void {
  const level = depth <= 0 ? "####" : depth === 1 ? "#####" : "######";
  out.push(`${level} ${CATEGORIA_LABEL[item.categoria]}: ${item.nome}`, "");

  const totvs = item.integracaoTotvs && item.categoria !== "campo" ? [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".") : "";

  switch (item.categoria) {
    case "campo": {
      if (item.detalhes) campoDetalhesBlock(item.detalhes, out);
      break;
    }
    case "texto": {
      out.push("###### Geral", "");
      out.push(kv(BASE, "Conteúdo", item.conteudoHtml ?? ""));
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      out.push(...logicaSpecLines(item.logica, BASE));
      out.push("");
      break;
    }
    case "agrupamento": {
      out.push("###### Geral", "");
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      if (totvs) out.push(kv(BASE, "TOTVS", totvs));
      if (item.cssCodigo) out.push(`${BASE}- CSS:`, `${BASE}  \`\`\``, `${BASE}  ${item.cssCodigo.split("\n").join(`\n${BASE}  `)}`, `${BASE}  \`\`\``);
      out.push("");

      if (item.camposAgrupados && item.camposAgrupados.length > 0) {
        out.push("###### Conteúdo", "");
        item.camposAgrupados.forEach((campo) => {
          out.push(`${BASE}- ${fieldRefMd(campo.nome)}`);
          out.push(...logicaSpecLines(campo.logica, BASE + "  "));
        });
        out.push("");
      }

      const personalizacao: string[] = [];
      if (item.padding) personalizacao.push(kv(BASE, "Padding", item.padding));
      if (item.larguraMaxima) personalizacao.push(kv(BASE, "Largura máxima", item.larguraMaxima));
      if (item.background) {
        personalizacao.push(`${BASE}- Background:`);
        if (item.background.tipo) personalizacao.push(kv(BASE + "  ", "Tipo", item.background.tipo));
        if (item.background.cor) personalizacao.push(kv(BASE + "  ", "Cor", item.background.cor));
        if (item.background.possuiImagemVinculada) personalizacao.push(kv(BASE + "  ", "Possui imagem vinculada", "Sim"));
      }
      if (personalizacao.length > 0) out.push("###### Personalização", "", ...personalizacao, "");

      if (item.alinhamento) {
        const alinhamentoLines = [
          item.alinhamento.direcao ? kv(BASE, "Direção", item.alinhamento.direcao) : null,
          item.alinhamento.horizontal ? kv(BASE, "Alinhamento horizontal", item.alinhamento.horizontal) : null,
          item.alinhamento.vertical ? kv(BASE, "Alinhamento vertical", item.alinhamento.vertical) : null,
        ].filter((l): l is string => !!l);
        if (alinhamentoLines.length > 0) out.push("###### Alinhamento", "", ...alinhamentoLines, "");
      }

      if (item.logica) out.push("###### Lógica", "", ...logicaSpecLines(item.logica, BASE), "");

      for (const child of item.filhos ?? []) renderItem(child, out, depth + 1);
      break;
    }
    case "botao": {
      out.push("###### Geral", "");
      if (item.nomeComponente) out.push(kv(BASE, "Nome do componente", item.nomeComponente));
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      out.push("");

      out.push(
        "###### Personalização",
        "",
        kv(BASE, "Título do botão", item.nome),
        kv(BASE, "Tema do botão", item.tema ?? "padrão"),
        kv(BASE, "Cor", `${item.corBotao ?? "padrão"}${item.usaCorInstitucional ? " (institucional)" : ""}`),
        kv(BASE, "Cor do texto", item.corTexto ?? "padrão"),
        kv(BASE, "Ícone", sim(item.temIcone)),
        kv(BASE, "Escondido", sim(item.escondido)),
        ""
      );

      out.push("###### Ações", "");
      out.push(kv(BASE, "Salvar dados", sim(item.salvaDados)));
      if (item.acoesPrimeiroPlano && item.acoesPrimeiroPlano.length > 0) {
        out.push(`${BASE}- Primeiro plano (síncrono):`);
        for (const acao of item.acoesPrimeiroPlano) out.push(...acaoLines(acao, BASE + "  "));
      }
      if (item.acoesSegundoPlano && item.acoesSegundoPlano.length > 0) {
        out.push(`${BASE}- Segundo plano (assíncrono):`);
        for (const acao of item.acoesSegundoPlano) out.push(...acaoLines(acao, BASE + "  "));
      }
      out.push(kv(BASE, "Fechar pop-up", sim(item.fecharPopup)));
      out.push(`${BASE}- Encaminhar usuário:`);
      out.push(kv(BASE + "  ", "Redireciona", sim(item.redirecionaUsuario)));
      if (item.encaminhamentos && item.encaminhamentos.length > 0) {
        for (const enc of item.encaminhamentos) out.push(...encaminhamentoLines(enc, BASE + "  "));
      }
      out.push("");
      break;
    }
    case "cep": {
      out.push("###### Geral", "");
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      out.push("");
      out.push("###### Configuração", "", kv(BASE, "Campo vinculado", item.campoCepVinculado ?? "(não identificado)"), kv(BASE, "Editável", sim(item.editavel)), "");
      break;
    }
    case "html": {
      out.push("###### Geral", "");
      out.push(kv(BASE, "Tipo", item.tipoHtml === "script" ? "Script" : "HTML"));
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      out.push("");
      out.push("###### Conteúdo", "", `${BASE}\`\`\``, `${BASE}${(item.conteudoHtml ?? "").split("\n").join(`\n${BASE}`)}`, `${BASE}\`\`\``, "");
      break;
    }
    case "upload": {
      out.push("###### Geral", "");
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      out.push("");
      const configuracao = [kv(BASE, "Tamanho máximo", `${item.tamanhoMaximoMb ?? "?"}MB`), kv(BASE, "Múltiplos arquivos", sim(item.multiplosArquivos))];
      for (const alvo of item.camposVinculadosUpload ?? []) configuracao.push(kv(BASE, alvo.papel, alvo.campo));
      out.push("###### Configuração", "", ...configuracao, "");
      break;
    }
    default:
      out.push("###### Geral", "", kv(BASE, "Tipo", item.tipo), ...(item.classeCss ? [kvCode(BASE, "Classe CSS", item.classeCss)] : []), "");
  }
}

/** Plain structural Markdown, following the heading hierarchy: h1 processo seletivo, h2 etapa,
 *  h3 passo, h4 componente, h5 campo, h6 as each campo/componente's own property groups
 *  (Identificação/Básico/Validação/... for a campo; Geral/Personalização/Alinhamento/... for a
 *  componente). Every bullet under a heading is indented (`BASE`) so it visually reads as
 *  grouped under that heading, and every value is highlighted with `**bold**` — code-like values
 *  (regex, custom-validation scripts, HTML/CSS/JS component content) use code blocks/backticks.
 *  Markdown carries no color/font, only this structural emphasis. Used for the ".md" download and
 *  as the `text/plain` fallback when copying for Google Docs. */
export function documentToMarkdown(doc: DocumentacaoPS): string {
  const lines: string[] = [];
  lines.push(`# ${doc.tituloPortal}`, "");

  for (const etapa of doc.etapas) {
    lines.push(`## Etapa: ${etapa.nome}`, "");
    lines.push(
      "#### Lógica de exibição",
      "",
      ...(etapa.logicaExibicao.regras.length > 0 ? logicaSpecLines(etapa.logicaExibicao, "") : ["Nenhuma restrição de exibição identificada."]),
      ""
    );
    lines.push("#### Descrição", "", etapa.descricao, "");
    lines.push(...consultaSqlLines("Fonte de dados da etapa", etapa.consultaSql));

    etapa.passos.forEach((passo) => {
      lines.push(`### Passo: ${passo.nome}`, "");
      lines.push(...consultaSqlLines("Fonte de dados do passo", passo.consultaSql));
      for (const item of passo.itens) renderItem(item, lines);
    });

    if (etapa.feedbacks.length > 0) {
      lines.push("#### Feedbacks", "");
      etapa.feedbacks.forEach((feedback, index) => {
        const conclusivo = feedback.conclusivo ? " **[conclusivo]**" : "";
        lines.push(`- Feedback ${index + 1} (${feedback.nome})${conclusivo}: **${feedback.condicao}**`);
      });
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}
