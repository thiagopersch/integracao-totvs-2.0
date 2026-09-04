import type { AcaoBotaoSpec, CampoDetalhado, ColunaDataserverSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, ParametroAcaoSpec, RegraLogicaItem } from "./types";

const sim = (v: boolean | undefined) => (v ? "Sim" : "Não");

/** Base indent for everything that sits directly under a heading (h4/h5/h6) — the "recuo à
 *  direita" that visually shows the bullets are grouped under the heading above them. Deeper
 *  nesting just concatenates two more spaces per level, same as before. */
const BASE = "  ";

/** "- Label: **value**" — the highlighted-value bullet format used everywhere. */
const kv = (indent: string, label: string, value: string) => `${indent}- ${label}: **${value}**`;
const kvCode = (indent: string, label: string, value: string) => `${indent}- ${label}: \`${value}\``;

function logicaText(logica: RegraLogicaItem[] | undefined): string | undefined {
  if (!logica || logica.length === 0) return undefined;
  return logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ");
}

/** codConsulta/codSistema/codColigada + cache/frequência + contexto — never lists the fields a
 *  query returns, only the query's own configuration (per explicit instruction). `indent` is the
 *  level this whole block starts at (passed in by the caller, already includes `BASE`). */
function fonteDadosLines(fonte: FonteDadosSpec, indent: string): string[] {
  if (!fonte.configurada) return [`${indent}- Fonte de dados: **nenhuma consulta vinculada**`];
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

function parametroLines(parametros: ParametroAcaoSpec[], indent: string): string[] {
  const lines = [kv(indent, "Parâmetros", sim(parametros.length > 0))];
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
    lines.push(...parametroLines(acao.parametros, body));
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

  const condicao = logicaText(acao.logica);
  if (condicao) lines.push(kv(body, "Condição", condicao));

  if (acao.fonteDados !== undefined) lines.push(...fonteDadosLines(acao.fonteDados, body));

  return lines;
}

function encaminhamentoLines(enc: EncaminhamentoSpec, indent: string): string[] {
  const lines = [kv(indent, "Tipo", enc.tipo)];
  if (enc.destino !== enc.tipo) lines.push(kv(indent, "Destino", `${enc.destino}${enc.novaAba ? " (nova aba)" : ""}`));
  else if (enc.novaAba) lines.push(kv(indent, "Nova aba", "Sim"));
  if (enc.parametros && enc.parametros.length > 0) lines.push(...parametroLines(enc.parametros, indent));
  const condicao = logicaText(enc.logica);
  if (condicao) lines.push(kv(indent + "  ", "Lógica", condicao));
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

/** Renders one item (heading `#####` for a campo, `####` for anything else — role-based, not
 *  depth-based, per explicit instruction) followed by its property groups as `######` sections,
 *  every bullet indented (`BASE`) under its heading, then — for an agrupamento — its children
 *  rendered the same way right after, so a campo's h5 heading naturally reads as "belonging to"
 *  the componente h4 heading before it. */
function renderItem(item: ItemSpec, out: string[]): void {
  const level = item.categoria === "campo" ? "#####" : "####";
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
      const logica = logicaText(item.logica);
      if (logica) out.push(kv(BASE, "Lógica", logica));
      out.push("");
      break;
    }
    case "agrupamento": {
      out.push("###### Geral", "");
      if (item.classeCss) out.push(kvCode(BASE, "Classe CSS", item.classeCss));
      if (totvs) out.push(kv(BASE, "TOTVS", totvs));
      out.push("");

      const personalizacao: string[] = [];
      if (item.larguraPorColuna) personalizacao.push(kv(BASE, "Configuração", `componente com ${item.larguraPorColuna.length} coluna(s), largura(s): ${item.larguraPorColuna.join(", ")}`));
      if (item.padding) personalizacao.push(kv(BASE, "Padding", item.padding));
      if (item.larguraMaxima) personalizacao.push(kv(BASE, "Largura máxima", item.larguraMaxima));
      if (item.temBackground) personalizacao.push(kv(BASE, "Background", item.corBackground ? `cor ${item.corBackground}` : item.temImagemBackground ? "possui imagem" : "configurado"));
      if (item.cssCodigo) personalizacao.push(`${BASE}- CSS:`, `${BASE}  \`\`\``, `${BASE}  ${item.cssCodigo.split("\n").join(`\n${BASE}  `)}`, `${BASE}  \`\`\``);
      if (personalizacao.length > 0) out.push("###### Personalização", "", ...personalizacao, "");

      if (item.alinhamento) out.push("###### Alinhamento", "", kv(BASE, "Alinhamento", item.alinhamento), "");

      const logica = logicaText(item.logica);
      if (logica) out.push("###### Lógica", "", kv(BASE, "Condição", logica), "");

      for (const child of item.filhos ?? []) renderItem(child, out);
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
    lines.push("#### Lógica de exibição", "", etapa.logicaExibicao, "");
    lines.push("#### Descrição", "", etapa.descricao, "");
    if (etapa.fontesDados.length > 0) {
      lines.push("#### Fontes de dados", "", `TOTVS/Rubeus: ${etapa.fontesDados.join(", ")}`, "");
    }

    etapa.passos.forEach((passo) => {
      lines.push(`### Passo: ${passo.nome}`, "");
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
