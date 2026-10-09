import type {
  AcaoBotaoSpec,
  ConsultaSqlSpec,
  DocumentacaoPS,
  EncaminhamentoSpec,
  ItemCategoria,
  ItemSpec,
  LogicaSpec,
  PaginaSpec,
  ParametroAcaoSpec,
  PopupSpec,
  PortalOverviewSpec,
} from "./types";

/** "Busca de campos PS": finds every place a field/component is used across already-parsed PS
 *  structures (the same `DocumentacaoPS`/`PortalOverviewSpec` the "Documentação PS" screen builds)
 *  — no I/O here, the page fetches and this module only walks the trees. */

export type TipoUso =
  | "Componente"
  | "Lógica de exibição"
  | "Condição de feedback"
  | "Ação do botão"
  | "Encaminhamento"
  | "Consulta SQL"
  | "Fonte de dados do campo"
  | "Vínculo de upload/CEP"
  | "Configuração do portal";

export const TIPOS_USO: TipoUso[] = [
  "Componente",
  "Lógica de exibição",
  "Condição de feedback",
  "Ação do botão",
  "Encaminhamento",
  "Consulta SQL",
  "Fonte de dados do campo",
  "Vínculo de upload/CEP",
  "Configuração do portal",
];

/** "—" for reference rows: the field isn't rendered there, only mentioned. */
export type OcultoStatus = "Sim" | "Condicional" | "Não" | "—";

export interface FieldSearchHit {
  id: string;
  portal: string;
  processo: string;
  etapa?: string;
  passo?: string;
  feedback?: string;
  pagina?: string;
  popup?: string;
  /** Enclosing agrupamentos, outermost first ("Endereço › Coluna 1"). */
  caminho?: string;
  componente: string;
  /** The component's internal name in the builder (`name`), shown as "componente | nomeComponente". */
  nomeComponente?: string;
  categoria: string;
  fieldId?: number;
  tipoUso: TipoUso;
  detalheUso?: string;
  oculto: OcultoStatus;
  motivoOculto?: string;
  /** Component that holds the hit (`GET /api/custom-component/{id}`) — rows with it can be
   *  expanded to show the component's full config. */
  componentId?: number;
  /** `position` of the button_action that matched, to highlight it in that detail. */
  acaoOrdem?: number;
  /** Structured action context for the exports: the action's name, and the column/parameter
   *  that matched with the value configured in it. */
  acao?: string;
  coluna?: string;
  valor?: string;
}

/** Classes that hide an item in the Rubeus form builder — valid on any item, and inherited by
 *  everything inside an agrupamento that carries one (per explicit instruction). */
export const HIDDEN_CLASSES = ["ps-input-hidden", "fields-hidden", "campos-ocultos"];

export interface SearchQuery {
  raw: string;
  norm: string;
  /** Set when the term is a bare number — also matches `field_id`. */
  id?: number;
  exact: boolean;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildQuery(raw: string, exact = false): SearchQuery {
  const norm = normalizeText(raw);
  return { raw, norm, id: /^\d+$/.test(norm) ? Number(norm) : undefined, exact };
}

function matchesText(value: string | undefined, q: SearchQuery): boolean {
  if (!value || !q.norm) return false;
  const v = normalizeText(value);
  return q.exact ? v === q.norm : v.includes(q.norm);
}

/** A configured fixed value (e.g. IDFV = "155") — always compared whole, so searching "1" doesn't
 *  hit every value containing a 1. */
function matchesValue(value: string | undefined, q: SearchQuery): boolean {
  return !!value && !!q.norm && normalizeText(value) === q.norm;
}

/** Field references are rendered by the parser as "Label (id)" or "campo #id" (`formatFieldRef`). */
function parseFieldRef(ref: string): { label?: string; id?: number } {
  const labelled = ref.match(/^(.*)\s\((\d+)\)\s*$/);
  if (labelled) return { label: labelled[1], id: Number(labelled[2]) };
  const bare = ref.match(/campo #(\d+)/);
  if (bare) return { id: Number(bare[1]) };
  return { label: ref };
}

function matchesRef(ref: string | undefined, q: SearchQuery): boolean {
  if (!ref) return false;
  const { label, id } = parseFieldRef(ref);
  if (q.id !== undefined && id === q.id) return true;
  return matchesText(label, q);
}

/** Free text holding one or more "Label (id)" refs (e.g. a feedback's condition sentence). */
function matchesFreeText(text: string | undefined, q: SearchQuery): boolean {
  if (!text || !q.norm) return false;
  if (q.id !== undefined && (text.includes(`(${q.id})`) || text.includes(`#${q.id}`))) return true;
  if (q.exact) return [...text.matchAll(/([^,;:()]+?)\s\(\d+\)/g)].some((m) => normalizeText(m[1]) === q.norm);
  return normalizeText(text).includes(q.norm);
}

function matchesItem(item: ItemSpec, q: SearchQuery): boolean {
  if (q.id !== undefined && item.fieldId === q.id) return true;
  return matchesText(item.nome, q) || matchesText(item.detalhes?.basico.rotulo, q) || matchesText(item.nomeComponente, q);
}

const CATEGORIA_LABEL: Record<ItemCategoria, string> = {
  campo: "Campo",
  texto: "Texto",
  agrupamento: "Agrupamento",
  botao: "Botão",
  cep: "CEP",
  html: "HTML",
  upload: "Upload",
  componente: "Componente",
};

function describeCategoria(item: ItemSpec): string {
  const base = CATEGORIA_LABEL[item.categoria] ?? item.categoria;
  return item.tipo && item.categoria === "campo" ? `${base} (${item.tipo})` : base;
}

function ownHiddenReason(item: ItemSpec): string | undefined {
  const classes = [item.classeCss, item.detalhes?.basico.classeCss]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/\s+/);
  const cls = HIDDEN_CLASSES.find((c) => classes.includes(c));
  if (cls) return `classe ${cls}`;
  if (item.detalhes?.basico.esconder || item.escondido) return "oculto no form builder (hidden)";
  return undefined;
}

function describeRegras(logica: LogicaSpec): string {
  return logica.regras.map((r) => [r.campo, r.regra, r.valor].filter(Boolean).join(" ")).join(logica.condicao?.includes("todas") ? " E " : " OU ");
}

function ownConditionalReason(item: ItemSpec): string | undefined {
  const logica = item.logica;
  if (!logica || logica.regras.length === 0) return undefined;
  if (logica.acao === "Ocultar") return `ocultado quando: ${describeRegras(logica)}`;
  if (logica.acao === "Mostrar") return `exibido somente quando: ${describeRegras(logica)}`;
  return undefined;
}

interface Location {
  portal: string;
  processo: string;
  etapa?: string;
  passo?: string;
  feedback?: string;
  pagina?: string;
  popup?: string;
  caminho: string[];
}

interface Inherited {
  hidden?: string;
  conditional?: string;
}

class HitCollector {
  private readonly hits = new Map<string, FieldSearchHit>();

  add(loc: Location, hit: Omit<FieldSearchHit, "id" | "portal" | "processo" | "etapa" | "passo" | "feedback" | "pagina" | "popup" | "caminho">) {
    const caminho = loc.caminho.length > 0 ? loc.caminho.join(" › ") : undefined;
    const full: Omit<FieldSearchHit, "id"> = {
      portal: loc.portal,
      processo: loc.processo,
      etapa: loc.etapa,
      passo: loc.passo,
      feedback: loc.feedback,
      pagina: loc.pagina,
      popup: loc.popup,
      caminho,
      ...hit,
    };
    const id = [full.portal, full.processo, full.etapa, full.passo, full.feedback, full.pagina, full.popup, caminho, full.componente, full.tipoUso, full.detalheUso].join("|");
    if (!this.hits.has(id)) this.hits.set(id, { id, ...full });
  }

  list(): FieldSearchHit[] {
    return [...this.hits.values()];
  }
}

function searchLogica(logica: LogicaSpec | undefined, owner: string, loc: Location, q: SearchQuery, out: HitCollector, categoria: string, componentId?: number, nomeComponente?: string) {
  if (!logica) return;
  for (const regra of logica.regras) {
    if (!matchesRef(regra.campo, q)) continue;
    out.add(loc, {
      componente: owner,
      categoria,
      tipoUso: "Lógica de exibição",
      detalheUso: `${logica.acao ?? "Regra"}: ${[regra.campo, regra.regra, regra.valor].filter(Boolean).join(" ")}`,
      oculto: "—",
      componentId,
      nomeComponente,
    });
  }
}

interface HitBase {
  componente: string;
  categoria: string;
  tipoUso: TipoUso;
  prefixo: string;
  componentId?: number;
  nomeComponente?: string;
  acaoOrdem?: number;
  acao?: string;
}

/** Value configured for a parameter: its bound system field or its fixed value. */
function valorParametro(p: ParametroAcaoSpec): string | undefined {
  return p.campoSistema ?? p.valorFixo;
}

function searchParametros(parametros: ParametroAcaoSpec[] | undefined, loc: Location, q: SearchQuery, out: HitCollector, { prefixo, ...base }: HitBase) {
  for (const p of parametros ?? []) {
    if (!matchesRef(p.campoSistema, q)) continue;
    out.add(loc, { ...base, detalheUso: `${prefixo} — parâmetro "${p.nome}" ← ${p.campoSistema}`, oculto: "—", coluna: p.nome, valor: valorParametro(p) });
  }
}

function searchConsultaSql(consulta: ConsultaSqlSpec | undefined, owner: string, loc: Location, q: SearchQuery, out: HitCollector) {
  if (!consulta?.configurada) return;
  searchParametros(consulta.parametros, loc, q, out, { componente: owner, categoria: "Consulta SQL", tipoUso: "Consulta SQL", prefixo: `Consulta ${consulta.codConsulta}` });
}

function searchAcao(acao: AcaoBotaoSpec, button: ItemSpec, loc: Location, q: SearchQuery, out: HitCollector) {
  const nomeAcao = acao.titulo ?? acao.descricao;
  const base = {
    componente: button.nome,
    categoria: "Botão",
    tipoUso: "Ação do botão" as const,
    componentId: button.componentId,
    nomeComponente: button.nomeComponente,
    acaoOrdem: acao.ordem,
    acao: nomeAcao,
  };
  const prefixo = `${acao.ordem + 1}. ${nomeAcao}`;
  const add = (detalhe: string, coluna?: string, valor?: string) => out.add(loc, { ...base, detalheUso: `${prefixo} — ${detalhe}`, oculto: "—", coluna, valor });

  // The action itself, by its name/description/code/dataserver/type.
  const identidade: [string | undefined, string][] = [
    [acao.titulo, "nome da ação"],
    [acao.descricao, "descrição"],
    [acao.acaoParametrizada, `consulta ${acao.acaoParametrizada}`],
    [acao.dataserver, `${acao.tipoAcao === "Executar processo" ? "processo" : "dataserver"} ${acao.dataserver}`],
    [acao.tipoAcao, acao.tipoAcao],
  ];
  const matchedIdentity = identidade.find(([value]) => matchesText(value, q));
  if (matchedIdentity) add(`${acao.tipoAcao} (${matchedIdentity[1]})`);

  // Fields/parameters configured inside the action, by name or fixed value.
  for (const p of acao.parametros) {
    if (matchesText(p.nome, q) || matchesValue(p.valorFixo, q)) add(`parâmetro "${p.nome}" = ${p.campoSistema ?? (p.valorFixo !== undefined ? `Valor fixo: ${p.valorFixo}` : "—")}`, p.nome, valorParametro(p));
    else if (matchesRef(p.campoSistema, q)) add(`parâmetro "${p.nome}" ← ${p.campoSistema}`, p.nome, valorParametro(p));
  }
  for (const col of acao.colunas ?? []) {
    const fixed = col.correspondente.startsWith("Valor fixo:") ? col.correspondente.slice("Valor fixo:".length).trim() : undefined;
    const coluna = `${col.tabela ? `${col.tabela}.` : ""}${col.coluna}`;
    const valor = fixed ?? col.correspondente;
    if (matchesText(col.coluna, q) || matchesText(col.tabela, q) || matchesValue(fixed, q)) add(`coluna ${coluna} = ${col.correspondente}`, coluna, valor);
    else if (matchesRef(col.correspondente, q)) add(`coluna ${coluna} ← ${col.correspondente}`, coluna, valor);
  }
  for (const campo of acao.camposConfigurados) {
    if (matchesRef(campo, q)) add(`campo configurado ${campo}`, campo);
  }
  if (acao.fonteDados?.configurada) {
    for (const ctx of acao.fonteDados.contexto) {
      if (matchesText(ctx.nome, q)) add(`contexto "${ctx.nome}" ← ${ctx.campoVinculado ?? "—"}`, ctx.nome, ctx.campoVinculado);
      else if (matchesRef(ctx.campoVinculado, q)) add(`contexto "${ctx.nome}" ← ${ctx.campoVinculado}`, ctx.nome, ctx.campoVinculado);
    }
  }
  if (acao.logica) {
    for (const regra of acao.logica.regras) {
      if (matchesRef(regra.campo, q)) add(`${acao.logica.acao ?? "regra"}: ${[regra.campo, regra.regra, regra.valor].filter(Boolean).join(" ")}`);
    }
  }
}

function searchEncaminhamento(enc: EncaminhamentoSpec, button: ItemSpec, loc: Location, q: SearchQuery, out: HitCollector, visited: Set<string>) {
  const prefixo = `${enc.tipo}: ${enc.destino}`;
  const base = { componente: button.nome, categoria: "Botão", tipoUso: "Encaminhamento" as const, componentId: button.componentId, nomeComponente: button.nomeComponente, acao: prefixo };
  if (enc.destino.startsWith("Campo do sistema:") && matchesRef(enc.destino.slice("Campo do sistema:".length).trim(), q)) {
    out.add(loc, { ...base, detalheUso: prefixo, oculto: "—" });
  }
  searchParametros(enc.parametros, loc, q, out, { ...base, prefixo });
  if (enc.logica) {
    for (const regra of enc.logica.regras) {
      if (matchesRef(regra.campo, q)) out.add(loc, { ...base, detalheUso: `${prefixo} — ${enc.logica.acao ?? "regra"}: ${[regra.campo, regra.regra, regra.valor].filter(Boolean).join(" ")}`, oculto: "—" });
    }
  }
  if (enc.popupDetalhe && enc.popupId && !visited.has(`popup:${enc.popupId}`)) {
    searchPopupInto(enc.popupDetalhe, { ...loc, popup: enc.popupDetalhe.nome, pagina: undefined, caminho: [] }, q, out, new Set([...visited, `popup:${enc.popupId}`]));
  }
  if (enc.paginaDetalhe && enc.paginaId && !visited.has(`page:${enc.paginaId}`)) {
    searchItems(enc.paginaDetalhe.itens, { ...loc, pagina: enc.paginaDetalhe.nome, popup: undefined, caminho: [] }, q, {}, out, new Set([...visited, `page:${enc.paginaId}`]));
  }
}

function searchItems(itens: ItemSpec[], loc: Location, q: SearchQuery, inherited: Inherited, out: HitCollector, visited: Set<string>) {
  for (const item of itens) {
    const ownHidden = ownHiddenReason(item);
    const ownConditional = ownConditionalReason(item);
    const hidden = ownHidden ?? inherited.hidden;
    const conditional = ownConditional ?? inherited.conditional;
    const categoria = describeCategoria(item);

    if (matchesItem(item, q)) {
      out.add(loc, {
        componente: item.nome,
        categoria,
        fieldId: item.fieldId,
        tipoUso: "Componente",
        oculto: hidden ? "Sim" : conditional ? "Condicional" : "Não",
        motivoOculto: hidden ?? conditional,
        componentId: item.componentId,
        nomeComponente: item.nomeComponente,
      });
    }

    searchLogica(item.logica, item.nome, loc, q, out, categoria, item.componentId, item.nomeComponente);

    for (const acao of [...(item.acoesPrimeiroPlano ?? []), ...(item.acoesSegundoPlano ?? [])]) searchAcao(acao, item, loc, q, out);
    for (const enc of item.encaminhamentos ?? []) searchEncaminhamento(enc, item, loc, q, out, visited);

    for (const vinculo of item.camposVinculadosUpload ?? []) {
      if (matchesRef(vinculo.campo, q)) out.add(loc, { componente: item.nome, categoria, tipoUso: "Vínculo de upload/CEP", detalheUso: `${vinculo.papel} ← ${vinculo.campo}`, oculto: "—", componentId: item.componentId, nomeComponente: item.nomeComponente });
    }
    if (matchesRef(item.campoCepVinculado, q)) {
      out.add(loc, { componente: item.nome, categoria, tipoUso: "Vínculo de upload/CEP", detalheUso: `CEP preenche ${item.campoCepVinculado}`, oculto: "—", componentId: item.componentId, nomeComponente: item.nomeComponente });
    }
    for (const p of item.detalhes?.dados.fonteExterna?.parametros ?? []) {
      if (matchesRef(p.campoVinculado, q)) out.add(loc, { componente: item.nome, categoria, tipoUso: "Fonte de dados do campo", detalheUso: `Fonte externa — parâmetro "${p.nome}" ← ${p.campoVinculado}`, oculto: "—", componentId: item.componentId, nomeComponente: item.nomeComponente });
    }

    if (item.filhos?.length) {
      const nested: Inherited = {
        hidden: inherited.hidden ?? (ownHidden ? `agrupamento "${item.nome}" (${ownHidden})` : undefined),
        conditional: inherited.conditional ?? (ownConditional ? `agrupamento "${item.nome}" ${ownConditional}` : undefined),
      };
      searchItems(item.filhos, { ...loc, caminho: [...loc.caminho, item.nome] }, q, nested, out, visited);
    }
  }
}

function searchPopupInto(popup: PopupSpec, loc: Location, q: SearchQuery, out: HitCollector, visited: Set<string>) {
  searchItems(popup.itens, loc, q, {}, out, visited);
  searchConsultaSql(popup.consultaSql, `Pop-up "${popup.nome}"`, loc, q, out);
}

export interface ProcessSearchSource {
  portal: string;
  processo: string;
  doc: DocumentacaoPS;
}

export function searchProcessDoc(source: ProcessSearchSource, q: SearchQuery): FieldSearchHit[] {
  const out = new HitCollector();
  if (!q.norm) return [];
  for (const etapa of source.doc.etapas) {
    const etapaLoc: Location = { portal: source.portal, processo: source.processo, etapa: etapa.nome, caminho: [] };
    searchLogica(etapa.logicaExibicao, `Etapa "${etapa.nome}"`, etapaLoc, q, out, "Etapa");
    searchConsultaSql(etapa.consultaSql, `Etapa "${etapa.nome}"`, etapaLoc, q, out);
    for (const passo of etapa.passos) {
      const passoLoc: Location = { ...etapaLoc, passo: passo.nome };
      searchItems(passo.itens, passoLoc, q, {}, out, new Set());
      searchConsultaSql(passo.consultaSql, `Passo "${passo.nome}"`, passoLoc, q, out);
    }
    for (const fb of etapa.feedbacks) {
      if (matchesFreeText(fb.condicao, q)) {
        out.add({ ...etapaLoc, feedback: fb.nome }, { componente: fb.nome, categoria: "Feedback", tipoUso: "Condição de feedback", detalheUso: fb.condicao, oculto: "—" });
      }
    }
  }
  return out.list();
}

export function searchPortalOverview(overview: PortalOverviewSpec, portal: string, q: SearchQuery): FieldSearchHit[] {
  const out = new HitCollector();
  if (!q.norm) return [];
  const loc: Location = { portal, processo: "—", caminho: [] };
  const geral = overview.geral;

  const camposPortal: [string, typeof geral.campoRegistro][] = [
    ["Campo de registro", geral.campoRegistro],
    ["Campo de oferta de curso", geral.campoOfertaCurso],
    ["Campo de local de oferta", geral.campoLocalOferta],
  ];
  for (const [papel, campo] of camposPortal) {
    if (!campo) continue;
    const { id } = parseFieldRef(campo.nome);
    if (matchesText(campo.nome, q) || matchesText(campo.detalhes.basico.rotulo, q) || (q.id !== undefined && id === q.id)) {
      out.add(loc, { componente: campo.nome, categoria: "Campo", tipoUso: "Configuração do portal", detalheUso: papel, oculto: "—" });
    }
  }
  for (const campo of geral.camposDetalhesInscricao ?? []) {
    if (matchesRef(campo.campoSistema, q)) {
      out.add(loc, { componente: campo.nome, categoria: "Detalhes da inscrição", tipoUso: "Configuração do portal", detalheUso: `Detalhes da inscrição ← ${campo.campoSistema}`, oculto: "—" });
    }
  }
  for (const consulta of overview.consultas) {
    const owner = `Consulta do portal ${consulta.codigo}`;
    searchParametros(consulta.parametros, loc, q, out, { componente: owner, categoria: "Consulta SQL", tipoUso: "Consulta SQL", prefixo: consulta.descricao || consulta.codigo });
    for (const ctx of consulta.contexto ?? []) {
      if (matchesRef(ctx.campoVinculado, q)) out.add(loc, { componente: owner, categoria: "Consulta SQL", tipoUso: "Consulta SQL", detalheUso: `contexto "${ctx.nome}" ← ${ctx.campoVinculado}`, oculto: "—" });
    }
  }
  if (geral.popupLgpd) {
    const popupLoc = { ...loc, popup: `${geral.popupLgpd.nome} (LGPD)` };
    searchItems(geral.popupLgpd.itens, popupLoc, q, {}, out, new Set());
    searchConsultaSql(geral.popupLgpd.consultaSql, `Pop-up "${geral.popupLgpd.nome}"`, popupLoc, q, out);
  }
  return out.list();
}

/** A pop-up/page not reached from any etapa (portal mode sweeps the whole catalog). */
export function searchStandaloneContainer(container: { kind: "popup"; spec: PopupSpec } | { kind: "page"; spec: PaginaSpec }, portal: string, q: SearchQuery): FieldSearchHit[] {
  const out = new HitCollector();
  if (!q.norm) return [];
  const base: Location = { portal, processo: "—", caminho: [] };
  if (container.kind === "popup") searchPopupInto(container.spec, { ...base, popup: container.spec.nome }, q, out, new Set());
  else searchItems(container.spec.itens, { ...base, pagina: container.spec.nome }, q, {}, out, new Set());
  return out.list();
}

/** Every encaminhamento in a doc pointing at a page or pop-up — the page uses it to know which
 *  `GET /api/pages/{id}` to fetch and which catalog pop-ups are already covered by an etapa. */
export function collectContainerReferences(doc: DocumentacaoPS): { pages: EncaminhamentoSpec[]; popupIds: Set<number> } {
  const pages: EncaminhamentoSpec[] = [];
  const popupIds = new Set<number>();
  const visit = (itens: ItemSpec[]) => {
    for (const item of itens) {
      for (const enc of item.encaminhamentos ?? []) {
        if (enc.paginaId) pages.push(enc);
        if (enc.popupId) {
          popupIds.add(enc.popupId);
          if (enc.popupDetalhe) visit(enc.popupDetalhe.itens);
        }
      }
      if (item.filhos) visit(item.filhos);
    }
  };
  for (const etapa of doc.etapas) for (const passo of etapa.passos) visit(passo.itens);
  return { pages, popupIds };
}
