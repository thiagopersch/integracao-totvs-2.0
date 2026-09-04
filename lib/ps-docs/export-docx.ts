import { Document, Packer, Paragraph, TextRun } from "docx";
import type { AcaoBotaoSpec, CampoDetalhado, ColunaDataserverSpec, DocumentacaoPS, EncaminhamentoSpec, FonteDadosSpec, ItemSpec, ParametroAcaoSpec, RegraLogicaItem, StyleConfig } from "./types";

const hex = (color: string) => color.replace("#", "");
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

function logicaText(logica: RegraLogicaItem[] | undefined): string | undefined {
  if (!logica || logica.length === 0) return undefined;
  return logica.map((l) => `${l.campo} ${l.regra}${l.valor !== undefined ? ` "${l.valor}"` : ""}`).join(" E ");
}

/** Builds the .docx following the same heading hierarchy as the HTML/Markdown exports
 *  (role-based, not depth-based): h1 processo seletivo / h2 etapa / h3 passo / h4 componente /
 *  h5 campo / h6 each campo/componente's own property groups. h1/h2 use their own colors; h3–h6
 *  all use `subheadingColor` at decreasing sizes. Every value is bolded (a real bold `TextRun`,
 *  matching the **highlighted** convention used in the Markdown/HTML exports) and code-like
 *  values (regex, custom-validation JS, HTML/CSS/JS component content) render in a monospace
 *  run/block. Runs entirely in the browser via `Packer.toBlob`. */
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

  const heading = (text: string, size: number, spaceBefore: number) =>
    new Paragraph({
      spacing: { before: spaceBefore, after: 100 },
      children: [new TextRun({ text, bold: true, font: style.bodyFont, color: hex(style.subheadingColor), size })],
    });
  const h3 = (text: string) => heading(text, 26, 300); // Passo
  const h4 = (text: string) => heading(text, 24, 220); // Componente
  const h5 = (text: string) => heading(text, 22, 160); // Campo
  const h6 = (text: string) => heading(text, 20, 120); // Property group

  const body = (text: string, options: { bullet?: boolean; bold?: boolean; indent?: number } = {}) =>
    new Paragraph({
      spacing: { after: 80 },
      bullet: options.bullet ? { level: options.indent ?? 0 } : undefined,
      indent: !options.bullet && options.indent ? { left: options.indent * 360 } : undefined,
      children: [new TextRun({ text, font: style.bodyFont, color: hex(style.bodyColor), size: 22, bold: options.bold })],
    });

  /** "Label: **value**" as one bulleted paragraph — the highlighted-value line used everywhere. */
  const kv = (label: string, value: string, indent = 0) =>
    new Paragraph({
      spacing: { after: 80 },
      bullet: { level: indent },
      children: [
        new TextRun({ text: `${label}: `, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
        new TextRun({ text: value, bold: true, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
      ],
    });

  const kvCode = (label: string, value: string, indent = 0) =>
    new Paragraph({
      spacing: { after: 80 },
      bullet: { level: indent },
      children: [
        new TextRun({ text: `${label}: `, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
        new TextRun({ text: value, font: "Courier New", color: hex(style.bodyColor), size: 20 }),
      ],
    });

  const titledBullet = (text: string, indent = 0) => body(text, { bullet: true, indent });

  function fonteDadosParagraphs(fonte: FonteDadosSpec): Paragraph[] {
    if (!fonte.configurada) return [kv("Fonte de dados", "nenhuma consulta vinculada")];
    const temContexto = fonte.contexto.length > 0;
    const out = [
      body("Fonte de dados", { bold: true }),
      kv("Coligada", fonte.codColigada),
      kv("Sistema", fonte.codSistema),
      kv("Consulta", fonte.codConsulta),
      kv("Cache", sim(fonte.usaCache)),
    ];
    if (fonte.usaCache) out.push(kv("Frequência do cache", fonte.frequenciaCache ?? "não informada"));
    out.push(kv("Contexto", sim(temContexto)));
    if (temContexto) {
      out.push(titledBullet("Parâmetros do contexto:", 1));
      for (const c of fonte.contexto) out.push(c.campoVinculado ? kv(c.nome, c.campoVinculado, 2) : titledBullet(c.nome, 2));
    }
    return out;
  }

  function parametrosParagraphs(parametros: ParametroAcaoSpec[], indent: number): Paragraph[] {
    const out = [kv("Parâmetros", sim(parametros.length > 0), indent)];
    for (const p of parametros) {
      out.push(titledBullet(`${p.nome} - ${p.tipo}`, indent + 1));
      if (p.tipo === "Campo do sistema" && p.campoSistema) out.push(kv("Campo do sistema", p.campoSistema, indent + 2));
      if (p.tipo === "Valor fixo" && p.valorFixo !== undefined) out.push(kv("Valor fixo", p.valorFixo, indent + 2));
    }
    return out;
  }

  function colunasParagraphs(colunas: ColunaDataserverSpec[], indent: number): Paragraph[] {
    if (colunas.length === 0) return [];
    const out = [titledBullet("Colunas:", indent)];
    for (const c of colunas) out.push(kv(`${c.coluna}${c.tabela ? ` (${c.tabela})` : ""}`, c.correspondente, indent + 1));
    return out;
  }

  /** One action per the user's exact target format — the fields shown depend on `tipoAcao`:
   *  Realizar Consulta shows its own código/campos vinculados/parâmetros (and NO Fonte de dados
   *  block, since that's already this); Salvar Dados/Executar processo show the dataserver +
   *  Coluna/Tabela/Correspondente table; Ação Rubeus shows campos configurados + eventos + pessoa
   *  vinculada, no parâmetros table. */
  function acaoParagraphs(acao: AcaoBotaoSpec): Paragraph[] {
    const out = [
      new Paragraph({
        spacing: { after: 80 },
        bullet: { level: 0 },
        children: [
          new TextRun({ text: `[${acao.ordem}] Tipo da ação: `, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
          new TextRun({ text: `${acao.tipoAcao}${acao.ativada ? "" : " [desativada]"}`, bold: true, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
        ],
      }),
    ];
    out.push(kv("Descrição", acao.descricao, 1));
    if (acao.mensagemErro) out.push(kv("Mensagem de erro", acao.mensagemErro, 1));

    if (acao.tipoAcao === "Realizar consulta") {
      out.push(kv("Código da consulta", acao.acaoParametrizada ?? "não identificado", 1));
      out.push(kv("Possui campo vinculado", sim(acao.camposConfigurados.length > 0), 2));
      if (acao.camposConfigurados.length > 0) {
        out.push(titledBullet("Campos:", 3));
        acao.camposConfigurados.forEach((c) => out.push(titledBullet(c, 4)));
      }
      out.push(...parametrosParagraphs(acao.parametros, 2));
    } else if (acao.tipoAcao === "Salvar dados" || acao.tipoAcao === "Executar processo") {
      out.push(kv("Dataserver", acao.dataserver ?? "não identificado", 1));
      if (acao.colunas) out.push(...colunasParagraphs(acao.colunas, 1));
      out.push(...parametrosParagraphs(acao.parametros, 1));
    } else if (acao.tipoAcao === "Ação Rubeus") {
      if (acao.camposConfigurados.length > 0) {
        out.push(titledBullet("Campos configurados:", 1));
        acao.camposConfigurados.forEach((c) => out.push(titledBullet(c, 2)));
      }
      if (acao.eventos && acao.eventos.length > 0) {
        out.push(titledBullet("Eventos:", 1));
        acao.eventos.forEach((e) => out.push(body(`${e.codigo} - ${e.descricao ?? "(evento não identificado)"}`, { bullet: true, indent: 2, bold: true })));
      }
      if (acao.pessoaVinculada) {
        out.push(titledBullet("Pessoa vinculada:", 1));
        out.push(kv("Identificador do contato", acao.pessoaVinculada.identificadorContato ?? "não informado", 2));
        if (acao.pessoaVinculada.tipoContato) out.push(kv("Tipo do contato", acao.pessoaVinculada.tipoContato, 2));
        out.push(kv("Altera contato principal", sim(acao.pessoaVinculada.alterarContatoPrincipal), 2));
      }
    } else {
      if (acao.camposConfigurados.length > 0) {
        out.push(titledBullet("Campos configurados:", 1));
        acao.camposConfigurados.forEach((c) => out.push(titledBullet(c, 2)));
      }
      out.push(...parametrosParagraphs(acao.parametros, 1));
    }

    const condicao = logicaText(acao.logica);
    if (condicao) out.push(kv("Condição", condicao, 1));
    if (acao.fonteDados !== undefined) out.push(...fonteDadosParagraphs(acao.fonteDados));
    return out;
  }

  function encaminhamentoParagraphs(enc: EncaminhamentoSpec): Paragraph[] {
    const out = [kv("Tipo", enc.tipo)];
    if (enc.destino !== enc.tipo) out.push(kv("Destino", `${enc.destino}${enc.novaAba ? " (nova aba)" : ""}`));
    else if (enc.novaAba) out.push(kv("Nova aba", "Sim"));
    if (enc.parametros && enc.parametros.length > 0) out.push(...parametrosParagraphs(enc.parametros, 0));
    const condicao = logicaText(enc.logica);
    if (condicao) out.push(kv("Lógica", condicao, 1));
    return out;
  }

  function validacaoParagraphs(detalhes: CampoDetalhado): Paragraph[] {
    const out: Paragraph[] = [];
    for (const v of detalhes.validacoes) {
      const isRegex = v.tipo.toLowerCase().includes("regular");
      out.push(kv(v.tipo, sim(v.ativado)));
      if (v.mensagem) out.push(kv("Mensagem", v.mensagem, 1));
      if (v.valor) out.push(isRegex ? kvCode("Valor", v.valor, 1) : kv("Valor", v.valor, 1));
      if (v.inverter !== undefined) out.push(kv("Inverter", sim(v.inverter), 1));
      if (v.codigo) {
        out.push(titledBullet("Código:", 1));
        out.push(body(v.codigo, { indent: 2 }));
      }
    }
    return out;
  }

  /** A campo's own detail — Identificação/Básico/Multivalorado/Validação/Dados/Propriedades/
   *  Vínculos, each its own h6. */
  function campoDetalhesParagraphs(detalhes: CampoDetalhado): Paragraph[] {
    const id = detalhes.identidade;
    const b = detalhes.basico;
    const dd = detalhes.dados;
    const out: Paragraph[] = [];

    out.push(h6("Identificação"));
    out.push(kv("Tipo", id.tipoCampo));
    if (id.tabelaProcessoSeletivo) out.push(kv("Tabela do processo seletivo", id.tabelaProcessoSeletivo));
    out.push(kv("Multivalorado", sim(id.multivalorado)));
    if (id.integracaoRubeus) {
      out.push(kv("Integração Rubeus", sim(id.integracaoRubeus.ativada)));
      if (id.integracaoRubeus.ativada) out.push(kv("Tabela | Coluna", `${id.integracaoRubeus.tabela ?? ""} | ${id.integracaoRubeus.coluna ?? ""}`, 1));
    }
    if (id.integracaoTotvs) {
      out.push(kv("Integração TOTVS", sim(id.integracaoTotvs.ativada)));
      if (id.integracaoTotvs.ativada) {
        out.push(kv("Tabela.Campo", `${id.integracaoTotvs.tabela ?? ""}.${id.integracaoTotvs.campo ?? ""}`, 1));
        if (id.integracaoTotvs.nomeAlternativo) out.push(kv("Nome alternativo", id.integracaoTotvs.nomeAlternativo, 1));
      }
    }

    out.push(h6("Básico"));
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
    for (const [label, value, code] of basicoEntries) if (value) out.push(code ? kvCode(label, value) : kv(label, value));
    out.push(kv("Desabilitar", sim(b.desabilitar)));
    out.push(kv("Esconder", sim(b.esconder)));
    out.push(kv("Esconder rótulo", sim(b.esconderRotulo)));

    if (detalhes.multivalorado) {
      out.push(h6("Multivalorado"));
      if (detalhes.multivalorado.minOpcoes != null) out.push(kv("Mínimo de opções", String(detalhes.multivalorado.minOpcoes)));
      if (detalhes.multivalorado.maxOpcoes != null) out.push(kv("Máximo de opções", String(detalhes.multivalorado.maxOpcoes)));
    }

    if (detalhes.validacoes.length > 0) {
      out.push(h6("Validação"));
      out.push(...validacaoParagraphs(detalhes));
    }

    out.push(h6("Dados"));
    if (dd.tipoValorPadrao) out.push(kv(`Valor padrão (${dd.tipoValorPadrao})`, dd.valorPadrao ?? ""));
    if (dd.fonteExterna) {
      out.push(titledBullet("Fonte externa:"));
      out.push(kv("Tipo de envio", dd.fonteExterna.tipoEnvio ?? "não informado", 1));
      out.push(kv("Link", dd.fonteExterna.link ?? "não informado", 1));
      out.push(kv("Salva automaticamente", sim(dd.fonteExterna.salvaAutomaticamente), 1));
      out.push(kv("Envia parâmetros", sim(dd.fonteExterna.enviaParametros), 1));
      if (dd.fonteExterna.parametros.length > 0) {
        out.push(titledBullet("Parâmetros:", 1));
        for (const p of dd.fonteExterna.parametros) out.push(p.campoVinculado ? kv(p.nome, p.campoVinculado, 2) : titledBullet(p.nome, 2));
      }
    }
    if (dd.opcoesPredefinidas?.ativado) {
      out.push(kv("Opções predefinidas", "Ativado"));
      out.push(kv("Fonte", dd.opcoesPredefinidas.fonte ?? "não identificada", 1));
      out.push(kv("Consulta SQL configurada", sim(dd.opcoesPredefinidas.consultaConfigurada), 1));
      if (dd.opcoesPredefinidas.opcoesManuais) {
        out.push(titledBullet("Opções manuais:", 1));
        for (const o of dd.opcoesPredefinidas.opcoesManuais) out.push(kv(o.label, o.value, 2));
      }
    } else {
      out.push(kv("Opções predefinidas", "Desativado"));
    }
    out.push(kv("Somente leitura", sim(dd.somenteLeitura)));

    const propriedadesEntries = Object.entries(detalhes.propriedades);
    if (propriedadesEntries.length > 0) {
      out.push(h6("Propriedades"));
      for (const [k, v] of propriedadesEntries) out.push(kv(k, v));
    }
    if (detalhes.vinculos.length > 0) {
      out.push(h6("Vínculos"));
      for (const v of detalhes.vinculos) out.push(titledBullet(v));
    }

    return out;
  }

  /** Renders one item as its own h5 (campo) or h4 (anything else — role-based, not depth-based,
   *  per explicit instruction) heading, followed by its property groups as h6 headings, then —
   *  for an agrupamento — its children right after. */
  function itemParagraphs(item: ItemSpec): Paragraph[] {
    const headingFn = item.categoria === "campo" ? h5 : h4;
    const out: Paragraph[] = [headingFn(`${CATEGORIA_LABEL[item.categoria]}: ${item.nome}`)];
    const totvs = item.integracaoTotvs && item.categoria !== "campo" ? [item.integracaoTotvs.tabela, item.integracaoTotvs.campo, item.integracaoTotvs.sentenca].filter(Boolean).join(".") : "";

    switch (item.categoria) {
      case "campo":
        if (item.detalhes) out.push(...campoDetalhesParagraphs(item.detalhes));
        break;
      case "texto": {
        out.push(h6("Geral"));
        out.push(
          new Paragraph({
            spacing: { after: 80 },
            bullet: { level: 0 },
            children: [
              new TextRun({ text: `Conteúdo: `, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
              new TextRun({ text: item.conteudoHtml ?? "", bold: true, font: style.bodyFont, color: hex(style.bodyColor), size: 22 }),
            ],
          })
        );
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));
        const logica = logicaText(item.logica);
        if (logica) out.push(kv("Lógica", logica));
        break;
      }
      case "agrupamento": {
        out.push(h6("Geral"));
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));
        if (totvs) out.push(kv("TOTVS", totvs));

        const personalizacao: Paragraph[] = [];
        if (item.larguraPorColuna) personalizacao.push(kv("Configuração", `componente com ${item.larguraPorColuna.length} coluna(s), largura(s): ${item.larguraPorColuna.join(", ")}`));
        if (item.padding) personalizacao.push(kv("Padding", item.padding));
        if (item.larguraMaxima) personalizacao.push(kv("Largura máxima", item.larguraMaxima));
        if (item.temBackground) personalizacao.push(kv("Background", item.corBackground ? `cor ${item.corBackground}` : item.temImagemBackground ? "possui imagem" : "configurado"));
        if (item.cssCodigo) {
          personalizacao.push(titledBullet("CSS:"));
          personalizacao.push(body(item.cssCodigo, { indent: 1 }));
        }
        if (personalizacao.length > 0) out.push(h6("Personalização"), ...personalizacao);

        if (item.alinhamento) out.push(h6("Alinhamento"), kv("Alinhamento", item.alinhamento));

        const logica = logicaText(item.logica);
        if (logica) out.push(h6("Lógica"), kv("Condição", logica));

        for (const child of item.filhos ?? []) out.push(...itemParagraphs(child));
        break;
      }
      case "botao": {
        out.push(h6("Geral"));
        if (item.nomeComponente) out.push(kv("Nome do componente", item.nomeComponente));
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));

        out.push(h6("Personalização"));
        out.push(kv("Título do botão", item.nome));
        out.push(kv("Tema do botão", item.tema ?? "padrão"));
        out.push(kv("Cor", `${item.corBotao ?? "padrão"}${item.usaCorInstitucional ? " (institucional)" : ""}`));
        out.push(kv("Cor do texto", item.corTexto ?? "padrão"));
        out.push(kv("Ícone", sim(item.temIcone)));
        out.push(kv("Escondido", sim(item.escondido)));

        out.push(h6("Ações"));
        out.push(kv("Salvar dados", sim(item.salvaDados)));
        if (item.acoesPrimeiroPlano && item.acoesPrimeiroPlano.length > 0) {
          out.push(titledBullet("Primeiro plano (síncrono):"));
          for (const acao of item.acoesPrimeiroPlano) out.push(...acaoParagraphs(acao));
        }
        if (item.acoesSegundoPlano && item.acoesSegundoPlano.length > 0) {
          out.push(titledBullet("Segundo plano (assíncrono):"));
          for (const acao of item.acoesSegundoPlano) out.push(...acaoParagraphs(acao));
        }
        out.push(kv("Fechar pop-up", sim(item.fecharPopup)));
        out.push(titledBullet("Encaminhar usuário:"));
        out.push(kv("Redireciona", sim(item.redirecionaUsuario), 1));
        if (item.encaminhamentos && item.encaminhamentos.length > 0) {
          for (const enc of item.encaminhamentos) out.push(...encaminhamentoParagraphs(enc));
        }
        break;
      }
      case "cep":
        out.push(h6("Geral"));
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));
        out.push(h6("Configuração"));
        out.push(kv("Campo vinculado", item.campoCepVinculado ?? "(não identificado)"));
        out.push(kv("Editável", sim(item.editavel)));
        break;
      case "html":
        out.push(h6("Geral"));
        out.push(kv("Tipo", item.tipoHtml === "script" ? "Script" : "HTML"));
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));
        out.push(h6("Conteúdo"));
        out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: item.conteudoHtml ?? "", font: "Courier New", color: hex(style.bodyColor), size: 20 })] }));
        break;
      case "upload": {
        out.push(h6("Geral"));
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));
        out.push(h6("Configuração"));
        out.push(kv("Tamanho máximo", `${item.tamanhoMaximoMb ?? "?"}MB`));
        out.push(kv("Múltiplos arquivos", sim(item.multiplosArquivos)));
        for (const alvo of item.camposVinculadosUpload ?? []) out.push(kv(alvo.papel, alvo.campo));
        break;
      }
      default:
        out.push(h6("Geral"));
        out.push(kv("Tipo", item.tipo));
        if (item.classeCss) out.push(kvCode("Classe CSS", item.classeCss));
    }

    return out;
  }

  for (const etapa of doc.etapas) {
    paragraphs.push(stage(`Etapa: ${etapa.nome}`));
    paragraphs.push(h4("Lógica de exibição"));
    paragraphs.push(body(etapa.logicaExibicao));
    paragraphs.push(h4("Descrição"));
    paragraphs.push(body(etapa.descricao));

    if (etapa.fontesDados.length > 0) {
      paragraphs.push(h4("Fontes de dados"));
      paragraphs.push(body(`TOTVS/Rubeus: ${etapa.fontesDados.join(", ")}`));
    }

    etapa.passos.forEach((passo) => {
      paragraphs.push(h3(`Passo: ${passo.nome}`));
      for (const item of passo.itens) paragraphs.push(...itemParagraphs(item));
    });

    if (etapa.feedbacks.length > 0) {
      paragraphs.push(h4("Feedbacks"));
      etapa.feedbacks.forEach((feedback, index) => {
        const conclusivo = feedback.conclusivo ? " [conclusivo]" : "";
        paragraphs.push(kv(`Feedback ${index + 1} (${feedback.nome})${conclusivo}`, feedback.condicao));
      });
    }
  }

  const document = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(document);
}
