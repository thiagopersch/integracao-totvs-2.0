import { encaminhamentoNome } from "./doc-options";
import { describeCustomValidation } from "./script-validation-text";
import { hiddenGroupReason, hiddenGroupTitle } from "./hidden-group";
import type { AcaoBotaoSpec, ConsultaSqlSpec, DocOptions, DocumentacaoPS, EtapaSpec, ItemSpec, LogicaSpec, RegraLogicaItem } from "./types";

/** Renderer-neutral form of the "Resumido (RB-33)" model — one line per field, numbered sections
 *  and one actions table per button. The HTML, DOCX and Markdown renderers only lay this out, so
 *  every wording decision lives here once. */

export interface Rb33Nota {
  texto: string;
  /** Script source, only when `incluirCodigoScript` is on. */
  codigo?: string;
}

export interface Rb33Item {
  tag?: string;
  nome: string;
  obrigatorio: boolean;
  /** " — exibido se …" / " — oculto se …", without the leading dash. */
  cond?: string;
  notas: Rb33Nota[];
}

/** An "agrupamento de campos ocultos": its fields are listed together in a highlighted block
 *  instead of mixed into the visible ones, each tagged "Oculto". */
export interface Rb33GrupoOculto {
  tipo: "grupoOculto";
  nome: string;
  /** "Agrupamento: X — campos ocultos (…)", or just "Agrupamento: X (…)" when X already says "oculto". */
  titulo: string;
  motivo: string;
  cond?: string;
  itens: Rb33Item[];
}

export type Rb33Entrada = Rb33Item | Rb33GrupoOculto;

export const isGrupoOculto = (e: Rb33Entrada): e is Rb33GrupoOculto => "tipo" in e && e.tipo === "grupoOculto";

export interface Rb33Passo {
  nome: string;
  fonteDados?: string;
  itens: Rb33Entrada[];
}

export interface Rb33AcaoLinha {
  tipo: string;
  /** Bold part of the description (the builder's own title for the action group). */
  titulo?: string;
  descricao?: string;
  queryCode?: string;
  logica?: string;
}

export interface Rb33Botao {
  titulo: string;
  cond?: string;
  linhas: Rb33AcaoLinha[];
}

export interface Rb33Feedback {
  rotulo: string;
  texto: string;
}

export interface Rb33Etapa {
  anchor: string;
  nome: string;
  /** "ID interno: 300555 · origem: 289755" */
  idLinha?: string;
  stageId?: number;
  logica: string[];
  descricao: string;
  fonteDados?: string;
  passos: Rb33Passo[];
  feedbacks: Rb33Feedback[];
  botoes: Rb33Botao[];
}

export interface Rb33Doc {
  titulo: string;
  subtitulo?: string;
  etapas: Rb33Etapa[];
}

export const RB33_SECTION = {
  logica: "1. Lógica para exibição",
  descricao: "2. Descrição",
  passos: "3. Passos",
  feedbacks: "4. Feedbacks",
  acoes: "5. Ações e integrações",
  acoesHint: "detectadas automaticamente — lidas da configuração de cada botão (aba \"Ações\" do construtor)",
  notas: "Notas adicionais",
  semAcoes: "Nenhuma ação configurada nos botões desta etapa.",
  colunas: ["Tipo da ação", "Descrição da ação", "Lógica da ação"] as const,
};

/** "Nome social (316120)" -> "Nome social". */
export function stripFieldId(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, "").trim();
}

const OPERATOR_TEXT: Record<string, string> = {
  "é igual": "igual a",
  "é igual a": "igual a",
  "é diferente": "diferente de",
  "é diferente de": "diferente de",
  "é desconhecido": "está desconhecido",
  "é conhecido": "está preenchido",
  "é maior": "maior que",
  "é maior que": "maior que",
  "é menor": "menor que",
  "é menor que": "menor que",
  contém: "contém",
  "não contém": "não contém",
};

function operatorText(regra: string): string {
  return OPERATOR_TEXT[regra.trim().toLowerCase()] ?? regra.trim().toLowerCase();
}

function valueText(valor: string): string {
  const v = valor.trim();
  if (v === "Selecionado" || v === "Não selecionado") return v.toLowerCase();
  return /\s/.test(v) ? `“${v}”` : v;
}

/** "Forma de ingresso contém ENEM" */
export function ruleText(r: RegraLogicaItem): string {
  const base = `${stripFieldId(r.campo)} ${operatorText(r.regra)}`;
  return r.valor !== undefined ? `${base} ${valueText(r.valor)}` : base;
}

function isOr(logica: LogicaSpec): boolean {
  return !!logica.condicao && /alguma/i.test(logica.condicao);
}

function isHide(logica: LogicaSpec): boolean {
  return !!logica.acao && /ocultar|não executar/i.test(logica.acao);
}

/** One line per rule ("A;" … "Z."), with a header line when the rules combine with OR or hide. */
export function logicaLines(logica: LogicaSpec | undefined): string[] {
  if (!logica || logica.regras.length === 0) return [];
  const rules = logica.regras.map(ruleText);
  const lines = rules.map((r, i) => `${r}${i === rules.length - 1 ? "." : ";"}`);
  const header: string[] = [];
  if (isHide(logica)) header.push(/executar/i.test(logica.acao ?? "") ? "Não executa quando:" : "Oculta quando:");
  if (isOr(logica) && rules.length > 1) header.push("(basta uma das condições abaixo)");
  return [...header, ...lines];
}

/** Single-line form for a table cell or an inline " — exibido se …". */
function logicaInline(logica: LogicaSpec | undefined): string | undefined {
  if (!logica || logica.regras.length === 0) return undefined;
  return logica.regras.map(ruleText).join(isOr(logica) ? " ou " : " e ");
}

function condText(logica: LogicaSpec | undefined): string | undefined {
  const inline = logicaInline(logica);
  if (!inline) return undefined;
  return `${isHide(logica!) ? "oculto" : "exibido"} se ${inline}.`;
}

function fonteDadosText(sql: ConsultaSqlSpec | undefined): string | undefined {
  if (!sql || !sql.configurada) return undefined;
  const params = sql.parametros
    .map((p) => `${p.nome} = ${p.tipo === "Valor fixo" ? (p.valorFixo ?? "") : stripFieldId(p.campoSistema ?? "")}`)
    .filter((p) => p.trim().length > 0);
  const cache = sql.usaCache ? `; cache${sql.frequenciaCache ? ` ${sql.frequenciaCache}` : ""}` : "";
  return `Consulta TOTVS ${sql.codConsulta} (coligada ${sql.codColigada}, sistema ${sql.codSistema}${params.length ? `; parâmetros: ${params.join(", ")}` : ""}${cache}).`;
}

function itemTag(item: ItemSpec): string | undefined {
  switch (item.categoria) {
    case "texto":
      return "Texto informativo";
    case "html":
      return item.tipoHtml === "script" ? "Script" : "HTML";
    case "upload":
      return "Documento";
    case "cep":
      return "CEP";
    case "componente":
      return "Componente";
    case "campo": {
      const t = (item.detalhes?.identidade.tipoCampo ?? item.tipo).toLowerCase();
      if (t === "checkbox" || t.includes("check")) return "Check";
      return undefined;
    }
    default:
      return undefined;
  }
}

/** TOTVS consulta that feeds the field's options (`totvs_query`), if any. */
function optionsQuery(item: ItemSpec): string | undefined {
  return item.integracaoTotvs?.sentenca?.trim() || undefined;
}

function totvsRef(item: ItemSpec): string | undefined {
  const t = item.detalhes?.identidade.integracaoTotvs;
  const tabela = t?.tabela ?? item.integracaoTotvs?.tabela;
  const campo = t?.campo ?? item.integracaoTotvs?.campo;
  if (tabela && campo) return `${tabela}.${campo}`;
  return tabela ?? campo;
}

function cascadeName(item: ItemSpec): string {
  return item.nomeSistema?.trim() || stripFieldId(item.nome);
}

interface Ctx {
  opts: Pick<DocOptions, "incluirCodigoScript">;
  labelByKey: Map<string, string>;
  /** consulta code -> every campo in the etapa that loads its options from it. */
  byQuery: Map<string, ItemSpec[]>;
}

const CAMPO_OCULTO_NOTA = "Campo oculto na tela.";

function campoNotas(item: ItemSpec, ctx: Ctx): Rb33Nota[] {
  const notas: Rb33Nota[] = [];
  const det = item.detalhes;

  for (const v of det?.validacoes ?? []) {
    if (!v.ativado || /obrigat/i.test(v.tipo)) continue;
    if (v.codigo !== undefined || /personalizad/i.test(v.tipo)) {
      notas.push({ texto: `Validação — personalizada (script): ${describeCustomValidation(v.codigo, ctx.labelByKey)}`, codigo: ctx.opts.incluirCodigoScript ? v.codigo : undefined });
      continue;
    }
    const detalhe = v.mensagem ?? v.valor;
    notas.push({ texto: `Validação — ${v.tipo}${detalhe ? `: ${detalhe}` : ""}${v.inverter ? " (invertida)" : ""}` });
  }
  // Older models (or a campo without the full ficha) still carry the flattened rule names.
  if (!det && item.regras) for (const r of item.regras) if (!/obrigat/i.test(r)) notas.push({ texto: `Validação — ${r}` });

  const opcoes = det?.dados.opcoesPredefinidas;
  const query = optionsQuery(item);
  const ref = totvsRef(item);
  if (query || (opcoes?.ativado && opcoes.fonte === "TOTVS")) {
    const others = query ? (ctx.byQuery.get(query) ?? []).filter((o) => o !== item).map(cascadeName) : [];
    const what = [query, ref ? `(${ref})` : undefined].filter(Boolean).join(" ");
    notas.push({ texto: `Opções carregadas dinamicamente via consulta TOTVS${what ? ` ${what}` : ""}${others.length ? ` — em cascata com: ${others.join(", ")}` : ""}.` });
  } else if (opcoes?.ativado && opcoes.fonte === "Fonte externa") {
    const link = det?.dados.fonteExterna?.link;
    notas.push({ texto: `Opções carregadas de fonte externa${link ? ` (${link})` : ""}.` });
  }

  const dados = det?.dados;
  if (dados?.tipoValorPadrao === "dinamico" && dados.valorPadrao) notas.push({ texto: `Valor padrão dinâmico: parâmetro “${dados.valorPadrao}”.` });
  else if (dados?.tipoValorPadrao === "simples" && dados.valorPadrao) notas.push({ texto: `Valor padrão: ${dados.valorPadrao}.` });
  if (dados?.somenteLeitura || det?.basico.desabilitar) notas.push({ texto: "Somente leitura." });
  if (det?.basico.esconder) notas.push({ texto: CAMPO_OCULTO_NOTA });
  return notas;
}

function uploadNotas(item: ItemSpec): Rb33Nota[] {
  const notas: Rb33Nota[] = [];
  if (item.tamanhoMaximoMb) notas.push({ texto: `Tamanho máximo do arquivo: ${item.tamanhoMaximoMb}MB.` });
  if (item.multiplosArquivos) notas.push({ texto: "Permite múltiplos arquivos." });
  if (item.extensoesBloqueadas) notas.push({ texto: "Bloqueia anexar arquivos de tipos não permitidos." });
  const query = optionsQuery(item);
  if (query) notas.push({ texto: `Consulta TOTVS: ${query}.` });
  for (const v of item.camposVinculadosUpload ?? []) notas.push({ texto: `${v.papel}: ${stripFieldId(v.campo)}.` });
  return notas;
}

/** The agrupamento's condition and the item's own, as one sentence — a rule repeated on both
 *  (common: the builder copies the container's logic onto its fields) is shown once. When either
 *  side hides or combines with OR, the two are kept as separate clauses so the meaning survives. */
function mergeCond(parent: LogicaSpec | undefined, own: LogicaSpec | undefined): string | undefined {
  if (!parent || parent.regras.length === 0) return condText(own);
  if (!own || own.regras.length === 0) return condText(parent);
  const simple = (l: LogicaSpec) => !isHide(l) && (!isOr(l) || l.regras.length === 1);
  if (simple(parent) && simple(own)) {
    const seen = new Set<string>();
    const regras = [...parent.regras, ...own.regras].filter((r) => {
      const k = ruleText(r);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return condText({ regras });
  }
  const a = condText(parent)!;
  const b = condText(own)!;
  return a === b ? a : `${a.slice(0, -1)}; e ${b}`;
}

/** Flattens agrupamentos (their logic is carried to the children) and drops buttons, which only
 *  appear in section 5. */
function flattenItems(items: ItemSpec[], ctx: Ctx, parentLogic?: LogicaSpec): Rb33Entrada[] {
  const out: Rb33Entrada[] = [];
  for (const item of items) {
    if (item.categoria === "botao") continue;
    if (item.categoria === "agrupamento") {
      const motivo = hiddenGroupReason(item);
      if (motivo) {
        out.push({
          tipo: "grupoOculto",
          nome: stripFieldId(item.nome),
          titulo: hiddenGroupTitle(stripFieldId(item.nome)),
          motivo,
          cond: mergeCond(parentLogic, item.logica),
          // Nested groups (hidden or not) all go into this one block; the group's own condition
          // is in the block header, so the children only show theirs.
          itens: flattenPlain(item.filhos ?? [], ctx).map((i) => ({
            ...i,
            tag: i.tag ? `Oculto · ${i.tag}` : "Oculto",
            // Already said by the block and the tag.
            notas: i.notas.filter((n) => n.texto !== CAMPO_OCULTO_NOTA),
          })),
        });
        continue;
      }
      out.push(...flattenItems(item.filhos ?? [], ctx, combineLogic(parentLogic, item.logica)));
      continue;
    }
    const notas = item.categoria === "campo" || item.categoria === "cep" ? campoNotas(item, ctx) : item.categoria === "upload" ? uploadNotas(item) : [];
    out.push({
      tag: itemTag(item),
      nome: stripFieldId(item.nome),
      obrigatorio: !!item.obrigatorio,
      cond: mergeCond(parentLogic, item.logica),
      notas,
    });
  }
  return out;
}

/** Every item under an agrupamento as plain lines (nested hidden groups lose their own block). */
function flattenPlain(items: ItemSpec[], ctx: Ctx, parentLogic?: LogicaSpec): Rb33Item[] {
  return flattenItems(items, ctx, parentLogic).flatMap((e) => (isGrupoOculto(e) ? e.itens : [e]));
}

/** An agrupamento inside another one: both conditions must hold. Kept simple — rules are
 *  concatenated with AND wording, which is how nested containers behave. */
function combineLogic(a: LogicaSpec | undefined, b: LogicaSpec | undefined): LogicaSpec | undefined {
  if (!a || a.regras.length === 0) return b;
  if (!b || b.regras.length === 0) return a;
  return { acao: a.acao, condicao: "Se todas as regras corresponderem", regras: [...a.regras, ...b.regras] };
}

function walkItems(items: ItemSpec[], visit: (item: ItemSpec) => void) {
  for (const item of items) {
    visit(item);
    if (item.filhos) walkItems(item.filhos, visit);
  }
}

function acaoLinha(a: AcaoBotaoSpec): Rb33AcaoLinha {
  const tipo = `${a.grupo}${a.plano === "segundo" ? " (2º plano)" : ""}${a.ativada ? "" : " — desativada"}`;
  const titulo = a.titulo?.trim() || undefined;
  const descricao = titulo ? undefined : a.descricao && a.descricao !== "(sem descrição)" ? a.descricao : a.tipoAcao;
  return { tipo, titulo, descricao, queryCode: a.acaoParametrizada, logica: logicaLines(a.logica).join("\n") || undefined };
}

/** Every button with at least one action or encaminhamento, in screen order — repeated buttons are
 *  kept (one table per occurrence), and buttons inside an opened pop-up follow it. */
function collectBotoes(items: ItemSpec[], local: string, out: Rb33Botao[], seenPopups: Set<number>) {
  walkItems(items, (item) => {
    if (item.categoria !== "botao") return;
    const acoes = [...(item.acoesPrimeiroPlano ?? []), ...(item.acoesSegundoPlano ?? [])];
    const linhas = acoes.map(acaoLinha);
    for (const enc of item.encaminhamentos ?? []) {
      linhas.push({ tipo: "Encaminhamento", descricao: encaminhamentoNome(enc) + (enc.novaAba ? " (nova aba)" : ""), logica: logicaLines(enc.logica).join("\n") || undefined });
    }
    if (linhas.length > 0) {
      out.push({ titulo: `Ações ao clicar em “${stripFieldId(item.nome)}” (${local})`, cond: condText(item.logica), linhas });
    }
    for (const enc of item.encaminhamentos ?? []) {
      const popup = enc.popupDetalhe;
      if (!popup || (enc.popupId !== undefined && seenPopups.has(enc.popupId))) continue;
      if (enc.popupId !== undefined) seenPopups.add(enc.popupId);
      collectBotoes(popup.itens, `Pop-up: ${popup.nome}`, out, seenPopups);
    }
  });
}

function feedbacksOf(etapa: EtapaSpec): Rb33Feedback[] {
  const total = etapa.feedbacks.length;
  return etapa.feedbacks.map((fb, i) => {
    const rotulo = `Feedback ${i + 1} (${fb.nome})${fb.conclusivo ? " · conclusivo" : ""}: `;
    const lines = fb.logica ? logicaLines(fb.logica) : [];
    if (lines.length > 0) return { rotulo, texto: lines.join("\n") };
    if (/^Sem condição própria/.test(fb.condicao) || !fb.condicao) {
      return { rotulo, texto: total === 1 ? "Sem lógica associada — único feedback da etapa." : "Sem lógica associada — feedback padrão (cai neste caso se nenhuma outra condição for atendida)." };
    }
    return { rotulo, texto: fb.condicao };
  });
}

function descricaoOf(etapa: EtapaSpec): string {
  const n = etapa.passos.length;
  // The parser's own "Etapa composta por N passo(s): …" is generated, not typed in the builder.
  if (etapa.descricao && !/^Etapa composta por|^\(sem passos/.test(etapa.descricao)) return etapa.descricao;
  return n > 1 ? `Ao acessar, o candidato deverá preencher as informações solicitadas divididas em ${n} passos.` : "Ao acessar, o candidato deverá preencher as informações solicitadas.";
}

export function buildRb33Etapa(etapa: EtapaSpec, index: number, opts: Pick<DocOptions, "incluirCodigoScript">): Rb33Etapa {
  const labelByKey = new Map<string, string>();
  const byQuery = new Map<string, ItemSpec[]>();
  for (const passo of etapa.passos) {
    walkItems(passo.itens, (item) => {
      if (item.chave && !labelByKey.has(item.chave)) labelByKey.set(item.chave, stripFieldId(item.nome));
      const q = item.categoria === "campo" ? optionsQuery(item) : undefined;
      if (q) byQuery.set(q, [...(byQuery.get(q) ?? []), item]);
    });
  }
  const ctx: Ctx = { opts, labelByKey, byQuery };

  const logica = logicaLines(etapa.logicaExibicao);
  const botoes: Rb33Botao[] = [];
  const seenPopups = new Set<number>();
  for (const passo of etapa.passos) collectBotoes(passo.itens, `Passo: ${passo.nome}`, botoes, seenPopups);

  const idParts = [etapa.id ? `ID interno: ${etapa.id}` : undefined, etapa.idOrigem ? `origem: ${etapa.idOrigem}` : undefined].filter(Boolean);

  return {
    anchor: `etapa-${etapa.id ?? index + 1}`,
    nome: etapa.nome,
    idLinha: idParts.length ? idParts.join(" · ") : undefined,
    stageId: etapa.id,
    logica:
      logica.length > 0
        ? logica
        : [index === 0 ? "A etapa ficará disponível para o candidato no momento em que ele acessar o link do portal para realizar a inscrição." : "Sem restrição de exibição configurada para esta etapa."],
    descricao: descricaoOf(etapa),
    fonteDados: fonteDadosText(etapa.consultaSql),
    passos: etapa.passos.map((p) => ({ nome: p.nome, fonteDados: fonteDadosText(p.consultaSql), itens: flattenItems(p.itens, ctx) })),
    feedbacks: feedbacksOf(etapa),
    botoes,
  };
}

export function buildRb33Doc(doc: DocumentacaoPS, opts: Pick<DocOptions, "incluirCodigoScript">): Rb33Doc {
  const sub = [doc.identifier ? `identifier ${doc.identifier}` : undefined, doc.idPortal ? `portal ${doc.idPortal}` : undefined, doc.idPs ? `selective_process_id ${doc.idPs}` : undefined].filter(Boolean);
  return {
    titulo: doc.tituloPortal,
    subtitulo: sub.length ? sub.join(" · ") : undefined,
    etapas: doc.etapas.map((e, i) => buildRb33Etapa(e, i, opts)),
  };
}
