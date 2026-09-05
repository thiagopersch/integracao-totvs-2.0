import type {
  AcaoBotaoSpec,
  BackgroundAgrupamentoSpec,
  CampoAgrupadoSpec,
  CampoDetalhado,
  ColunaDataserverSpec,
  ConsultaSqlSpec,
  DocumentacaoPS,
  EncaminhamentoSpec,
  EtapaSpec,
  EventoRubeusSpec,
  FeedbackSpec,
  FonteDadosSpec,
  IntegracaoTotvsSpec,
  ItemSpec,
  LogicaSpec,
  ParametroAcaoSpec,
  PassoSpec,
  PessoaVinculadaSpec,
  PopupSpec,
  RegraLogicaItem,
  TipoAcao,
  ValidacaoRegra,
} from "./types";

/** Id->title/name catalogs fetched once by the caller and threaded through the whole parse, so
 *  actions/encaminhamentos can resolve ids to real names instead of showing "#id" placeholders.
 *  Confirmed live: `list-totvs-action-types` (1/2/3 -> Realizar Consulta/Salvar Dados/Executar
 *  processo), `list-data-server-types`/`list-process-types` ({id,title}), `popups`/`pages`
 *  ({id,name}). */
export interface ActionCatalogs {
  actionTypes: Map<number, string>;
  dataServerTypes: Map<number, string>;
  processTypes: Map<number, string>;
  popups: Map<number, string>;
  pages: Map<number, string>;
  /** `rubeus_event` on an Ações Rubeus action's `events[]` is a STRING code (e.g. "107"), resolved
   *  via `POST /list-rubeus-events` — keyed as a string since the raw value is one. */
  rubeusEvents: Map<string, string>;
  /** For an Ações Rubeus action's `relatedPerson` ("Pessoa vinculada") — resolved via
   *  `GET /api/crm/person-types`. Shape of `relatedPerson` itself unconfirmed live (always `null`
   *  on the processes checked so far), so this is threaded through defensively. */
  personTypes: Map<string, string>;
}

export const EMPTY_CATALOGS: ActionCatalogs = {
  actionTypes: new Map(),
  dataServerTypes: new Map(),
  processTypes: new Map(),
  popups: new Map(),
  pages: new Map(),
  rubeusEvents: new Map(),
  personTypes: new Map(),
};

/** Builds an `id -> title|name` lookup from any of the small `{id, title}`/`{id, name}` catalog
 *  endpoints (`list-totvs-action-types`, `list-data-server-types`, `list-process-types`, `popups`,
 *  `pages`). */
export function buildIdTitleCatalog(payload: unknown): Map<number, string> {
  const catalog = new Map<number, string>();
  for (const entry of asArray(unwrapData(payload))) {
    const id = Number(entry.id);
    const label = firstString(entry, ["title", "name"]);
    if (id && label) catalog.set(id, label);
  }
  return catalog;
}

/** Same idea as `buildIdTitleCatalog` but string-keyed and tolerant of a wider set of id/label key
 *  names — used for `list-rubeus-events` (shape unconfirmed) and `GET /api/crm/person-types`
 *  (confirmed live: a bare array of `{id: "1", titulo: "Aluno"}` — note `titulo`, not `title`).
 *  Any entry missing both an id-like and a label-like key is silently skipped, same defensive
 *  spirit as the rest of this parser. */
export function buildStringKeyedCatalog(payload: unknown): Map<string, string> {
  const catalog = new Map<string, string>();
  for (const entry of asArray(unwrapData(payload))) {
    const id = firstString(entry, ["id", "value", "code", "event_id", "rubeus_event", "person_type_id", "type_id"]) ?? (typeof entry.id === "number" ? String(entry.id) : undefined);
    const label = firstString(entry, ["titulo", "name", "title", "description", "label", "event_description"]);
    if (id && label) catalog.set(id, label);
  }
  return catalog;
}

/**
 * Maps the raw JSON returned by the Rubeus "processo seletivo" builder API
 * (`admin.portal.apprbs.com.br/api/selective-process/*` and `/api/settings/field/{id}`) into the
 * documentation model. Confirmed live against three real processes/tenants — see the plan file
 * for the full request/response shapes. The calls that feed this:
 *  - `GET  /opening-page-process/{idPs}`                -> process title
 *  - `GET  /opening-page-stages/{idPs}`                 -> list of stages ("etapas"), each with its
 *    `steps` (id/name only) and its own display `logics` (stage-level visibility rule)
 *  - `POST /standard-fields` (no body)                  -> global field catalog (`field_id -> label`),
 *    fetched once and used to resolve every `field_compare_id`/`field_id_to_save_*` reference
 *  - `POST /selected-stage/{idPs}` body `{stage_id, editor:true}` (one call per stage) -> that
 *    stage's `steps`, now with the real `content` array (fields/components, in display order).
 *    A field's own record here has the SAME shape as `GET /api/settings/field/{id}` (confirmed by
 *    diffing one against the other) — `form_build`, `totvs_table`/`totvs_field`, `rubeus_table`/
 *    `rubeus_field`, `ps_table`, `field_relation`, `external_source`, `data_value`/`data_type`,
 *    `manual_options`, `predefined_external_source` — so every "Edição do campo" tab (Identidade/
 *    Básico/Validação/Dados/Propriedades/Vínculos) is already available without an extra call per
 *    field. A button's action pipeline lives inline on its content item as `button_actions`
 *    (grouped by `execution_group`: 1 = "Primeiro plano", 2 = "Segundo plano" — confirmed by a
 *    button whose two `position: 0` groups differ only by `execution_group`) and `forwardData`
 *    (redirect/"encaminhar" actions).
 *  - `POST /feedback` body `{stage_id, editor:true}` (one call per stage) -> that stage's feedbacks
 *
 * Still defensive by design (never throws on an unexpected shape, accumulates `warnings` instead)
 * since this is reverse-engineered from real processes — a different one could vary slightly.
 */

type Raw = Record<string, unknown>;

export interface StagePayload {
  list: Raw; // one entry from GET /opening-page-stages/{idPs}
  selectedStage: unknown; // POST /selected-stage/{idPs} response for this stage
  feedback: unknown; // POST /feedback response for this stage
  stageQuery?: unknown; // GET /selective-process/get-stage-querys/{stage_id} response for this stage
  stepQueries?: Record<number, unknown>; // step_id -> GET /step/querys/{step_id} response
}

export interface ParseResult {
  model: DocumentacaoPS;
  warnings: string[];
}

/** `rule_logic_id` values observed on real processes, decoded by cross-checking against the
 *  reference .docx's plain-language description of the same rules (e.g. "maior que 4 e menor
 *  que 8" <-> rule_logic_id 5 then 6 on the same field). Unknown ids fall back to a literal id. */
const OPERATOR_LABELS: Record<number, string> = {
  1: "é igual",
  2: "é diferente",
  3: "é desconhecido",
  4: "é conhecido",
  5: "é maior",
  6: "é menor",
  7: "contém",
  8: "não contém",
};

/** `rule_logic_id`s 3 ("É desconhecido") and 4 ("É conhecido") check whether the field itself has
 *  a value at all — they never take one of their own (per explicit instruction), unlike every
 *  other rule id (1/2/5/6/7/8), which always requires one. */
const OPERATORS_WITHOUT_VALUE = new Set([3, 4]);

/** `action_logic_id` (1/2) worded per explicit instruction — differently depending on whether the
 *  logic belongs to an ELEMENT ("Mostrar este elemento"/"Ocultar este elemento") or an ACTION
 *  ("Executar esta ação"/"Não executar esta ação"). */
const ACTION_LOGIC_LABELS_ELEMENTO: Record<number, string> = { 1: "Mostrar", 2: "Ocultar" };
const ACTION_LOGIC_LABELS_ACAO: Record<number, string> = { 1: "Executar", 2: "Não executar" };

/** `condition_logic_id` (1/2) — how a `logics[]` array's rules combine, per explicit instruction:
 *  1 = OR ("se alguma dessas regras corresponder"), 2 = AND ("se todas as regras corresponderem"). */
const CONDITION_LOGIC_LABELS: Record<number, string> = {
  1: "Se alguma dessas regras corresponder",
  2: "Se todas as regras corresponderem",
};

/** `cache_interval_type_id` — how often a query's cache refreshes, per explicit instruction. Used
 *  everywhere a `usaCache`/`frequenciaCache` pair is documented: stage/step/popup/page/componente
 *  fontes de dados (`buildFonteDados`/`buildConsultaSql` below) and the portal-level "Consultas
 *  TOTVS" section (`actions/integrations/ps-portal-docs.ts`). */
const CACHE_INTERVAL_LABELS: Record<number, string> = {
  1: "15 minutos",
  2: "30 minutos",
  3: "1 hora",
  4: "2 horas",
  5: "3 horas",
  6: "6 horas",
  7: "12 horas",
  8: "Diário",
  9: "Semanal",
};

/** Falls back to the raw id (as a string) when it doesn't match a known interval, same defensive
 *  spirit as the rest of this parser — never throws or silently drops it, per explicit instruction
 *  that only unset (`null`/`undefined`) should read as "não informada" at the call site. */
export function formatCacheInterval(cacheIntervalTypeId: unknown): string | undefined {
  if (cacheIntervalTypeId === null || cacheIntervalTypeId === undefined) return undefined;
  const id = Number(cacheIntervalTypeId);
  return CACHE_INTERVAL_LABELS[id] ?? String(cacheIntervalTypeId);
}

/** Portuguese labels for the alignment enums used by `layout_direction`/`*_alignment` — matches
 *  the wording the builder's own UI uses for these dropdowns. Rendered as "PT (raw)" — e.g.
 *  "Espaço entre (space-between)" — per explicit instruction, so the original English enum value
 *  stays visible/greppable alongside the translation. */
const DIRECTION_LABELS: Record<string, string> = { row: "Linha", column: "Coluna" };
const ALIGN_LABELS: Record<string, string> = { start: "Início", center: "Centro", end: "Fim", "space-between": "Espaço entre", "space-around": "Espaço ao redor", stretch: "Esticar" };

/** `type`/`form_build.type` (Form.io component type) -> human label, for "Tipo do campo". */
const FIELD_TYPE_LABELS: Record<string, string> = {
  textfield: "Campo de texto",
  text: "Campo de texto",
  textarea: "Área de texto",
  email: "E-mail",
  number: "Número",
  select: "Seleção (select)",
  radio: "Múltipla escolha (radio)",
  checkbox: "Caixa de seleção (checkbox)",
  selectboxes: "Caixas de seleção múltiplas",
  phoneNumber: "Telefone",
  datetime: "Data/hora",
  file: "Upload de arquivo",
  upload: "Upload de arquivo",
  password: "Senha",
  hidden: "Campo oculto",
};

function operatorLabel(ruleLogicId: unknown): string {
  const id = Number(ruleLogicId);
  return OPERATOR_LABELS[id] ?? `regra ${String(ruleLogicId)}`;
}

/** "PT (raw)" — e.g. `labelWithRaw(DIRECTION_LABELS, "row")` -> "Linha (row)" — falls back to just
 *  the raw value when it's not in the map (nothing to translate). */
function labelWithRaw(map: Record<string, string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  const label = map[value];
  return label ? `${label} (${value})` : value;
}

function alignLabel(value: string | undefined): string | undefined {
  return labelWithRaw(ALIGN_LABELS, value);
}

function asArray(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((v): v is Raw => !!v && typeof v === "object");
  if (value && typeof value === "object") return [value as Raw]; // a Rubeus action group's `actions` is sometimes one object, not an array
  return [];
}

function unwrapData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const obj = payload as Raw;
  return "data" in obj ? obj.data : obj;
}

function firstString(obj: Raw, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFormBuild(raw: unknown): Raw {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Raw;
    } catch {
      return {};
    }
  }
  return {};
}

/** Builds a `field_id -> label` lookup. Used with two sources, merged by the caller
 *  (`new Map([...standardFields, ...settingsFields])`): `POST /standard-fields` (confirmed live)
 *  and `GET /api/settings/fields` ("every field known to the app", per explicit instruction —
 *  covers ids `standard-fields` doesn't, e.g. 316191 "IDPS", 316210 "CPF").
 *
 *  A THIRD source, `GET /api/custom-component/custom-component-simple`, plus a per-id
 *  `GET /api/custom-component/{id}` fallback for ids still missing, were both tried here earlier
 *  and reverted — real tests showed them returning wrong-but-plausible labels for these same
 *  system-field ids (e.g. 316191 resolving to "Botões", a builder-palette-sounding name, not a
 *  real field label). Those two are about UI *components*, not system *fields*, and ids apparently
 *  collide across the two id spaces — don't reintroduce either without confirming live that the
 *  specific id being looked up is actually a component, not a system field. */
export function buildFieldCatalog(payload: unknown): Map<number, string> {
  const catalog = new Map<number, string>();
  for (const field of asArray(unwrapData(payload))) {
    const id = Number(field.field_id ?? field.id);
    const label = firstString(field, ["label", "name", "title"]);
    if (id && label) catalog.set(id, label);
  }
  return catalog;
}

/** Canonical "field reference" formatter — every place that resolves a `field_id` through the
 *  catalog shows it as `"Nome do campo (field_id)"`, per explicit instruction, so the id stays
 *  visible/greppable (to cross-check against the builder) even once the label is known. Falls
 *  back to `campo #<id>` when the catalog doesn't have that id, and to `unresolvedFallback` when
 *  there's no id at all. */
function formatFieldRef(fieldId: unknown, fieldCatalog: Map<number, string>, unresolvedFallback = "(campo não identificado)"): string {
  const id = Number(fieldId);
  if (!id) return unresolvedFallback;
  const label = fieldCatalog.get(id);
  return label ? `${label} (${id})` : `campo #${id}`;
}

/** Same as `formatFieldRef`, but for the optional call sites that previously used
 *  `resolveFieldLabel` (no id at all -> `undefined`, so the caller can omit the field entirely
 *  instead of showing a placeholder). */
export function formatFieldRefOptional(fieldId: unknown, fieldCatalog: Map<number, string>): string | undefined {
  const id = Number(fieldId);
  if (!id) return undefined;
  return formatFieldRef(id, fieldCatalog);
}

function ruleToItem(rule: Raw, fieldCatalog: Map<number, string>): RegraLogicaItem {
  const campo = formatFieldRef(rule.field_compare_id, fieldCatalog);
  const regra = operatorLabel(rule.rule_logic_id);
  const valor = OPERATORS_WITHOUT_VALUE.has(Number(rule.rule_logic_id)) || rule.fixed_value === null || rule.fixed_value === undefined || rule.fixed_value === "" ? undefined : String(rule.fixed_value);
  return { campo, regra, valor };
}

/** A `logics` array is a list of conditions that are all required (AND) — confirmed by comparing
 *  a two-entry `logics` array (rule 5 "maior que 4" + rule 6 "menor que 8" on the same field)
 *  against the .docx's "deve estar entre maior que 4 e menor que 8". */
function describeLogicsStructured(logics: unknown, fieldCatalog: Map<number, string>): RegraLogicaItem[] | undefined {
  const rules = asArray(logics);
  if (rules.length === 0) return undefined;
  return rules.map((r) => ruleToItem(r, fieldCatalog));
}

function logicsToText(items: RegraLogicaItem[] | undefined): string | undefined {
  if (!items || items.length === 0) return undefined;
  return items.map((i) => `${i.campo} ${i.regra}${i.valor !== undefined ? ` "${i.valor}"` : ""}`).join(" E ");
}

/** The full `LogicaSpec` (regras + their own `action_logic_id`/`condition_logic_id` header) for any
 *  raw record that carries a `logics` array — reads `action_logic_id`/`condition_logic_id` off the
 *  SAME raw object `logics` came from (confirmed live: sibling fields on the same record, e.g. a
 *  stage's own `get-stage-querys` object). `wording` picks which of the two `action_logic_id`
 *  phrasings applies: "elemento" (Mostrar/Ocultar) for a displayed component, "acao" (Executar/Não
 *  executar) for a button action or encaminhamento. Returns `undefined` when there are no rules,
 *  same as `describeLogicsStructured` — nothing to show either way. */
function describeLogica(raw: Raw, fieldCatalog: Map<number, string>, wording: "elemento" | "acao"): LogicaSpec | undefined {
  const regras = describeLogicsStructured(raw.logics, fieldCatalog);
  if (!regras || regras.length === 0) return undefined;
  const actionLabels = wording === "acao" ? ACTION_LOGIC_LABELS_ACAO : ACTION_LOGIC_LABELS_ELEMENTO;
  return {
    acao: actionLabels[Number(raw.action_logic_id)],
    condicao: CONDITION_LOGIC_LABELS[Number(raw.condition_logic_id)],
    regras,
  };
}

function describeTotvsIntegration(item: Raw): IntegracaoTotvsSpec | undefined {
  const table = firstString(item, ["totvs_table"]);
  const field = firstString(item, ["totvs_field"]);
  const sentenca = firstString(item, ["totvs_query"]);
  if (!table && !field && !sentenca) return undefined;
  return { tabela: table, campo: field, sentenca };
}

/** `configurada: false` unless codColigada + codSistema + codConsulta are ALL present, per
 *  explicit instruction — an action/query without a real TOTVS consulta must say so plainly.
 *  Field names (`colligate`/`system`/`identifier`/`use_cache`/`cache_interval_type_id`) confirmed
 *  live inside a real button's `button_actions[].actions[]` entry. */
function buildFonteDados(raw: Raw, fieldCatalog: Map<number, string>): FonteDadosSpec {
  const colligate = raw.colligate;
  const system = raw.system;
  const identifier = raw.identifier;
  if (colligate === null || colligate === undefined || colligate === "" || !system || !identifier) {
    return { configurada: false };
  }

  const contexto = asArray(raw.parameters).map((p) => ({
    nome: firstString(p, ["name"]) ?? "(parâmetro)",
    campoVinculado: formatFieldRefOptional(p.field_id, fieldCatalog),
  }));

  return {
    configurada: true,
    codColigada: String(colligate),
    codSistema: String(system),
    codConsulta: String(identifier),
    usaCache: raw.use_cache === true || raw.use_cache === 1,
    frequenciaCache: formatCacheInterval(raw.cache_interval_type_id),
    contexto,
  };
}

/** Pulls every candidate query record out of a `get-stage-querys`/`step/querys` response —
 *  unwraps a `{data: ...}` envelope first. The two endpoints disagree on shape, confirmed live:
 *  `get-stage-querys/{stage_id}`'s `data` is the STAGE object itself, with the query nested under
 *  its own `query` key; `step/querys/{step_id}`'s `data` is an ARRAY of query records directly (no
 *  `query` wrapper — each array entry already has `colligate`/`system`/`code`/... on it). Handled
 *  generically here so either shape (or a single flat object) yields the right candidate list. */
function extractQueryCandidates(payload: unknown): Raw[] {
  const unwrapped = unwrapData(payload);
  const nodes = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
  const candidates: Raw[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const obj = node as Raw;
    if (obj.query && typeof obj.query === "object" && !Array.isArray(obj.query)) candidates.push(obj.query as Raw);
    else candidates.push(obj);
  }
  return candidates;
}

/** `configurada: true` requires `colligate` + `system` + `code` ALL present — confirmed live field
 *  names (`colligate`, not `collidate`) against a real `get-stage-querys`/`step/querys` response. */
function isQueryConfigured(raw: Raw): boolean {
  const colligate = raw.colligate;
  return !(colligate === null || colligate === undefined || colligate === "") && !!raw.system && !!raw.code;
}

/** The real configured SQL query for a stage/step (`get-stage-querys`/`step/querys`) — unlike
 *  `buildFonteDados` (an action's own query config), this one's `parameters[]` entries carry
 *  `parameter_type_id` (1 = campo do sistema, 2 = valor fixo) instead of `fixed_param`, and there's
 *  no `contexto` concept here, only `parametros`. When a response carries more than one candidate
 *  (the step endpoint's array), the first CONFIGURED one wins; falls back to the first candidate
 *  (which will read as unconfigured) when none are. `usaCache` reads the record's own `use_cache`
 *  boolean — confirmed live as a real, separate field from `cache_interval_type_id` (the frequency). */
function buildConsultaSql(payload: unknown, fieldCatalog: Map<number, string>): ConsultaSqlSpec {
  const candidates = extractQueryCandidates(payload);
  const raw = candidates.find(isQueryConfigured) ?? candidates[0];
  if (!raw || !isQueryConfigured(raw)) return { configurada: false };

  const parametros: ParametroAcaoSpec[] = asArray(raw.parameters).map((p) => {
    const nome = firstString(p, ["name"]) ?? "(parâmetro)";
    if (Number(p.parameter_type_id) === 2) {
      return { nome, tipo: "Valor fixo", valorFixo: p.fixed_value !== null && p.fixed_value !== undefined ? String(p.fixed_value) : undefined };
    }
    return { nome, tipo: "Campo do sistema", campoSistema: formatFieldRefOptional(p.field_id, fieldCatalog) };
  });

  return {
    configurada: true,
    codColigada: String(raw.colligate),
    codSistema: String(raw.system),
    codConsulta: String(raw.code),
    usaCache: raw.use_cache === true || raw.use_cache === 1,
    frequenciaCache: formatCacheInterval(raw.cache_interval_type_id),
    parametros,
  };
}

function describeAlignment(item: Raw): { direcao?: string; horizontal?: string; vertical?: string } | undefined {
  const direction = firstString(item, ["layout_direction"]);
  const horizontal = firstString(item, ["layout_direction_alignment"]);
  const vertical = firstString(item, ["layout_perpendicular_alignment"]);
  if (!direction && !horizontal && !vertical) return undefined;
  return {
    direcao: labelWithRaw(DIRECTION_LABELS, direction),
    horizontal: alignLabel(horizontal),
    vertical: alignLabel(vertical),
  };
}

/** One action "campo configurado" — prefers the fully-qualified TOTVS name (`title`, e.g.
 *  "SPSUSUARIO.NOME"), falling back to the Rubeus field path for actions that bind Rubeus fields
 *  instead (a Rubeus-type action's `fields[]` entries have `totvs_field`/`rubeus_field`, no `title`). */
function describeActionField(f: Raw): string {
  return (
    firstString(f, ["title"]) ??
    (firstString(f, ["totvs_table"]) && firstString(f, ["totvs_field"]) ? `${f.totvs_table}.${f.totvs_field}` : undefined) ??
    firstString(f, ["rubeus_field"]) ??
    (f.field_id ? `campo #${f.field_id}` : "(campo)")
  );
}

/** An Ações Rubeus action's "campo configurado" — unlike `describeActionField`, this shows the
 *  system field's own RÓTULO (via the field catalog, by `field_id`) as the primary name, with the
 *  TOTVS integration name in parens as secondary context, e.g. "Nome completo (SPSUSUARIO.NOME)"
 *  — per explicit instruction, since the raw TOTVS name alone isn't how the field reads elsewhere
 *  in the document. */
function describeRubeusActionField(f: Raw, fieldCatalog: Map<number, string>): string {
  const fieldId = Number(f.field_id);
  const rotulo = fieldId ? fieldCatalog.get(fieldId) : undefined;
  const totvsName = firstString(f, ["totvs_table"]) && firstString(f, ["totvs_field"]) ? `${f.totvs_table}.${f.totvs_field}` : undefined;
  if (rotulo && totvsName) return `${rotulo} (${totvsName})`;
  if (rotulo) return rotulo;
  if (totvsName) return totvsName;
  return firstString(f, ["rubeus_field"]) ?? (fieldId ? `campo #${fieldId}` : "(campo)");
}

/** `action.title` ("Realizar Consulta"/"Salvar Dados"/"Executar processo", confirmed present
 *  verbatim on the action record itself) is the primary signal; `list-totvs-action-types`
 *  (`action_type_id` 1/2/3) is a fallback for the rare case that title is missing. A group whose
 *  `button_actions_type_id` is 2/3/4 (Ações Rubeus/Integrações/Gerar relatório) is identified by
 *  the GROUP, not the action — those actions carry no `action_type_id` from that catalog. */
const ACTION_TITLE_TO_TIPO: Record<string, TipoAcao> = {
  "Realizar Consulta": "Realizar consulta",
  "Salvar Dados": "Salvar dados",
  "Executar processo": "Executar processo",
  "Executar Processo": "Executar processo",
};

function resolveTipoAcao(group: Raw, action: Raw, actionTypes: Map<number, string>): TipoAcao {
  const buttonActionsTypeId = Number(group.button_actions_type_id);
  if (buttonActionsTypeId === 2) return "Ação Rubeus";
  if (buttonActionsTypeId === 3) return "Integração";
  if (buttonActionsTypeId === 4) return "Gerar relatório";

  const title = firstString(action, ["title"]);
  if (title && ACTION_TITLE_TO_TIPO[title]) return ACTION_TITLE_TO_TIPO[title];
  const catalogLabel = actionTypes.get(Number(action.action_type_id));
  if (catalogLabel && ACTION_TITLE_TO_TIPO[catalogLabel]) return ACTION_TITLE_TO_TIPO[catalogLabel];
  return "Realizar consulta";
}

/** One "Nome campo / Tipo do campo / Campo sistema" row — `fixed_param` (0/1) decides whether the
 *  parameter is bound to a system field (`field_id`, resolved via the catalog) or carries a
 *  literal fixed value (confirmed live against both a Realizar Consulta's and a Salvar Dados's
 *  own `parameters[]`). */
function buildParametros(action: Raw, fieldCatalog: Map<number, string>): ParametroAcaoSpec[] {
  return asArray(action.parameters).map((p): ParametroAcaoSpec => {
    const nome = firstString(p, ["name"]) ?? "(parâmetro)";
    if (p.fixed_param === 1) {
      return { nome, tipo: "Valor fixo", valorFixo: p.fixed_value !== null && p.fixed_value !== undefined ? String(p.fixed_value) : undefined };
    }
    return { nome, tipo: "Campo do sistema", campoSistema: formatFieldRefOptional(p.field_id, fieldCatalog) };
  });
}

/** The "Coluna / Tabela / Correspondente" table for a Salvar Dados/Executar processo action —
 *  built from the action's own `fields[]` (confirmed live: `{field_id, title, totvs_table,
 *  totvs_column, fixed_value}` — a DIFFERENT shape from a Realizar Consulta's `fields[]`, which
 *  are the query's own returned/bound fields instead). */
function buildColunas(action: Raw, fieldCatalog: Map<number, string>): ColunaDataserverSpec[] {
  return asArray(action.fields).map((f): ColunaDataserverSpec => {
    const coluna = firstString(f, ["totvs_column", "title"]) ?? "(coluna)";
    const tabela = firstString(f, ["totvs_table"]);
    let correspondente: string;
    if (f.fixed_value !== null && f.fixed_value !== undefined && f.fixed_value !== "") {
      correspondente = `Valor fixo: ${String(f.fixed_value)}`;
    } else {
      correspondente = formatFieldRef(f.field_id, fieldCatalog, "(não identificado)");
    }
    return { coluna, tabela, correspondente };
  });
}

/** `rubeus_event` is a string code (e.g. "107") — resolved to its real name via the
 *  `list-rubeus-events` catalog, falling back to the event's own `event_description` (when the
 *  builder sent one inline) and finally to the bare code. */
function buildEventos(action: Raw, rubeusEvents: Map<string, string>): EventoRubeusSpec[] | undefined {
  const events = asArray(action.events);
  if (events.length === 0) return undefined;
  return events.map((e) => {
    const codigo = firstString(e, ["rubeus_event"]) ?? "(evento)";
    return { codigo, descricao: rubeusEvents.get(codigo) ?? firstString(e, ["event_description"]) };
  });
}

/** `relatedPerson` was `null` on every real Ações Rubeus action checked live, so this stays
 *  defensive about its shape — built only when there's something to show, from either
 *  `relatedPerson` or the sibling `field_id_save_contact_rubeus`. `tipoContato` is resolved via
 *  the `crm/person-types` catalog when `relatedPerson` carries a recognizable type id. */
function buildPessoaVinculada(action: Raw, fieldCatalog: Map<number, string>, personTypes: Map<string, string>): PessoaVinculadaSpec | undefined {
  const related = action.relatedPerson && typeof action.relatedPerson === "object" ? (action.relatedPerson as Raw) : undefined;
  const saveContactFieldId = Number(action.field_id_save_contact_rubeus);
  if (!related && !saveContactFieldId) return undefined;

  const relatedFieldId = related ? Number(related.field_id ?? related.contact_field_id) : undefined;
  const identificadorContato = formatFieldRefOptional(relatedFieldId, fieldCatalog) ?? formatFieldRefOptional(saveContactFieldId, fieldCatalog);

  const tipoContatoId = related ? firstString(related, ["person_type_id", "contact_type_id", "type_id"]) : undefined;
  const tipoContatoLabel = tipoContatoId ? personTypes.get(tipoContatoId) : undefined;

  return {
    identificadorContato,
    // "id - título" per explicit instruction, e.g. "1 - Aluno" (confirmed live: `GET
    // /api/crm/person-types` returns `[{id: "1", titulo: "Aluno"}, ...]`).
    tipoContato: tipoContatoId && tipoContatoLabel ? `${tipoContatoId} - ${tipoContatoLabel}` : (related ? firstString(related, ["contact_type", "type", "identifier"]) : undefined),
    alterarContatoPrincipal: !!(related && (related.change_main_contact === true || related.change_main_contact === 1 || related.is_main === true)),
  };
}

/** Maps one `button_actions[]` group (each carries exactly one conceptual action, though its
 *  `actions` key is sometimes a single object instead of a 1-item array depending on the action
 *  type) into an `AcaoBotaoSpec`, tagging it with its `execution_group` (1 = primeiro plano,
 *  2 = segundo plano — confirmed live). */
function mapButtonActionGroups(item: Raw, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): AcaoBotaoSpec[] {
  const groups = [...asArray(item.button_actions)].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const result: AcaoBotaoSpec[] = [];
  for (const group of groups) {
    const groupTitle = firstString((group.button_actions_type as Raw) ?? {}, ["title"]) ?? "Ação";
    const errorMessage = firstString(group, ["error_message"]);
    const position = Number(group.position ?? 0);
    const plano = Number(group.execution_group) === 2 ? "segundo" : "primeiro";
    const ativada = group.status === 1;
    for (const action of asArray(group.actions)) {
      const tipoAcao = resolveTipoAcao(group, action, catalogs.actionTypes);
      const isConsulta = tipoAcao === "Realizar consulta";
      const isDataAction = tipoAcao === "Salvar dados" || tipoAcao === "Executar processo";
      const isRubeus = tipoAcao === "Ação Rubeus";

      result.push({
        ordem: position,
        plano,
        grupo: groupTitle,
        tipoAcao,
        descricao: stripHtml(firstString(action, ["discription", "description"]) ?? "(sem descrição)"),
        mensagemErro: errorMessage,
        acaoParametrizada: isConsulta ? firstString(action, ["code"]) : undefined,
        dataserver: isDataAction
          ? tipoAcao === "Salvar dados"
            ? catalogs.dataServerTypes.get(Number(action.totvs_data_server_type_id))
            : catalogs.processTypes.get(Number(action.totvs_process_type_id))
          : undefined,
        colunas: isDataAction ? buildColunas(action, fieldCatalog) : undefined,
        camposConfigurados: isDataAction ? [] : asArray(action.fields).map((f) => (isRubeus ? describeRubeusActionField(f, fieldCatalog) : describeActionField(f))),
        parametros: buildParametros(action, fieldCatalog),
        eventos: isRubeus ? buildEventos(action, catalogs.rubeusEvents) : undefined,
        pessoaVinculada: isRubeus ? buildPessoaVinculada(action, fieldCatalog, catalogs.personTypes) : undefined,
        logica: describeLogica(action, fieldCatalog, "acao"),
        ativada,
        fonteDados: isConsulta ? undefined : buildFonteDados(action, fieldCatalog),
      });
    }
  }
  return result;
}

/** `redirect_type_id` (1-9) on each `forwardData[]` entry — confirmed live against the builder's
 *  own "Destino" dropdown (screenshot walkthrough), in the exact order/wording it uses. */
const REDIRECT_TYPE_LABELS: Record<number, string> = {
  1: "Próximo passo ou feedback",
  2: "Passo anterior",
  3: "Para outra etapa",
  4: "Ir para portal",
  5: "Link externo",
  6: "Ir para outra página",
  7: "Abrir pop-up",
  8: "Ficar na mesma tela e atualizar dados",
  9: "Escolha de processo seletivo",
};

/** Resolves an encaminhamento's target, branching on `redirect_type_id` since each type points
 *  at a different kind of destination (confirmed live: type 7 carries `popup_id`, type 1 carries
 *  neither `popup_id` nor `page_id` nor `link` — it's just "próximo passo"). `popups`/`pages` are
 *  resolved via their catalogs (`GET /api/popups`/`GET /api/pages`, both `{id, name}`); "Link
 *  externo" (type 5) is either a `link_field_id` bound to a system field or a fixed `link`
 *  (`link_field_type_id`: 1 = campo do sistema, 2 = valor fixo — confirmed live against a real
 *  `GET /api/custom-component/{id}` response: `link_field_type_id: 2` with a real `link` and
 *  `link_field_id: null`; this was previously inverted, which showed a configured fixed link as an
 *  unresolved "campo do sistema" with no link at all). */
function describeForwardTarget(fd: Raw, catalogs: ActionCatalogs, fieldCatalog: Map<number, string>): string {
  const type = Number(fd.redirect_type_id);
  switch (type) {
    case 1:
    case 2:
    case 8:
    case 9:
      return REDIRECT_TYPE_LABELS[type];
    case 3:
      return fd.stage_id ? `Outra etapa (etapa #${fd.stage_id})` : "Outra etapa";
    case 4:
      return "Portal";
    case 5: {
      // "Link externo" is already conveyed by `tipo` (REDIRECT_TYPE_LABELS[5]) — `destino` here
      // only needs the value's own kind ("Campo do sistema"/"Valor fixo") + its value, per
      // explicit instruction, not a repeated "Link externo" prefix.
      if (fd.link_field_type_id === 1) {
        const fieldRef = formatFieldRefOptional(fd.link_field_id, fieldCatalog);
        return fieldRef ? `Campo do sistema: ${fieldRef}` : "Campo do sistema";
      }
      const link = firstString(fd, ["link"]);
      return link ? `Valor fixo: ${link}` : "Valor fixo";
    }
    case 6:
      return fd.page_id ? (catalogs.pages.get(Number(fd.page_id)) ?? `Página #${fd.page_id}`) : "Página";
    case 7:
      return fd.popup_id ? (catalogs.popups.get(Number(fd.popup_id)) ?? `Popup #${fd.popup_id}`) : "Pop-up";
    default:
      if (fd.popup_id) return catalogs.popups.get(Number(fd.popup_id)) ?? `Popup #${fd.popup_id}`;
      if (fd.page_id) return catalogs.pages.get(Number(fd.page_id)) ?? `Página #${fd.page_id}`;
      return firstString(fd, ["link"]) ?? "(destino não identificado)";
  }
}

/** `use_parameters`/`logic_enabled` (0/1) gate whether `parameters[]`/`logics[]` are actually in
 *  effect for this encaminhamento — confirmed live: a real `forwardData` entry carries empty
 *  `parameters`/`logics` arrays alongside these flags regardless of whether they're set, so the
 *  flag (not just array length) decides whether the section is shown at all. */
function mapForwardData(item: Raw, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): EncaminhamentoSpec[] {
  return asArray(item.forwardData)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((fd) => {
      const type = Number(fd.redirect_type_id);
      const usaParametros = fd.use_parameters === 1 || fd.use_parameters === true;
      const parametros = usaParametros ? buildParametros(fd, fieldCatalog) : [];
      const logicaAtiva = fd.logic_enabled === 1 || fd.logic_enabled === true;
      return {
        tipo: REDIRECT_TYPE_LABELS[type] ?? `tipo ${type || "desconhecido"}`,
        destino: describeForwardTarget(fd, catalogs, fieldCatalog),
        novaAba: fd.new_tab === 1 || fd.new_tab === true,
        parametros: parametros.length > 0 ? parametros : undefined,
        logica: logicaAtiva ? describeLogica(fd, fieldCatalog, "acao") : undefined,
        // Type 7 = "Abrir pop-up" — `popupId` is threaded through so the fetch layer
        // (actions/integrations/ps-docs.ts) knows which `GET /api/popups/{id}` calls to make and
        // where to attach the result (`popupDetalhe`, filled in after this parse returns).
        popupId: type === 7 && fd.popup_id ? Number(fd.popup_id) : undefined,
      };
    });
}

/** A raw value that may come back as a string or a number ("altura"/"largura" fields on a pop-up)
 *  — stringified when present, `undefined` when null/empty (so the caller can show its own
 *  "não definida" fallback text). */
function numericOrStringField(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return value === null || value === undefined || value === "" ? undefined : String(value);
}

/** A pop-up's own full config — `GET /api/popups/{popup_id}`, per explicit instruction. `content`
 *  is a flat item list, parsed exactly like a passo's own `content` (same `mapItem` tree — a
 *  pop-up is a single self-contained screen, not multiple steps). `rawPopupQuery` is the separate
 *  `GET /api/popups/querys/{popup_id}` response — confirmed live to be the exact same shape as
 *  `step/querys/{step_id}` (an array of query records), so it's handed straight to the same
 *  `buildConsultaSql` used for a stage/step's own query. */
export function parsePopup(rawPopup: unknown, rawPopupQuery: unknown, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): PopupSpec {
  const data = (unwrapData(rawPopup) as Raw) ?? {};
  return {
    nome: firstString(data, ["name"]) ?? "(pop-up sem nome)",
    permiteFechar: data.allow_close_popup === 1 || data.allow_close_popup === true,
    alturaMaxima: numericOrStringField(data, "maximum_height"),
    larguraMaxima: numericOrStringField(data, "maximum_width"),
    itens: asArray(data.content).map((item) => mapItem(item, fieldCatalog, catalogs)),
    consultaSql: buildConsultaSql(rawPopupQuery, fieldCatalog),
  };
}

/** Walks an already-parsed etapa's item tree collecting every encaminhamento that references a
 *  pop-up (`popupId` set) — used by the fetch layer to know which `GET /api/popups/{id}` calls to
 *  make, and as the exact list of objects to mutate (`popupDetalhe = ...`) once each fetch
 *  resolves, without needing to re-walk or rebuild the tree. */
export function collectPopupReferences(etapa: EtapaSpec): EncaminhamentoSpec[] {
  const found: EncaminhamentoSpec[] = [];
  const visitItem = (item: ItemSpec) => {
    if (item.encaminhamentos) for (const enc of item.encaminhamentos) if (enc.popupId) found.push(enc);
    if (item.filhos) item.filhos.forEach(visitItem);
  };
  for (const passo of etapa.passos) passo.itens.forEach(visitItem);
  return found;
}

function resolveUploadTargets(item: Raw, fieldCatalog: Map<number, string>): { papel: string; campo: string }[] {
  const roles: [string, string][] = [
    ["field_id_to_save_upload", "Arquivo (base64/link)"],
    ["field_id_to_save_path_upload", "Caminho do arquivo"],
    ["field_id_to_save_filename_upload", "Nome do arquivo"],
    ["field_id_to_save_file_extension_upload", "Extensão do arquivo"],
    ["type_file_field_id_to_save_upload", "Tipo do arquivo"],
    ["status_field_id_to_save_upload", "Status do envio"],
    ["field_id_to_save_chaverm_upload", "Chave RM"],
    ["field_id_to_save_additional_upload", "Campo adicional 1"],
    ["field_id_to_save_additional_2_upload", "Campo adicional 2"],
    ["base64_field_id_to_save_upload", "Conteúdo base64"],
  ];
  const targets: { papel: string; campo: string }[] = [];
  for (const [key, papel] of roles) {
    const fieldId = Number(item[key]);
    if (!fieldId) continue;
    targets.push({ papel, campo: formatFieldRef(fieldId, fieldCatalog) });
  }
  return targets;
}

/** Every "Validação" rule the builder supports, one case per `key` seen live — confirmed against
 *  `GET /api/settings/field/{id}` for a field with all 5 rules configured (Obrigatório, Mínimo de
 *  palavras, Validação personalizada, Máximo de caracteres, Expressão regular). Unknown rule keys
 *  still get a generic entry so nothing is silently dropped. */
function mapValidationRules(formBuild: Raw): ValidacaoRegra[] {
  const validatorData = formBuild.validatorData as Raw | undefined;
  if (!validatorData || !Array.isArray(validatorData.data)) return [];

  return (validatorData.data as Raw[]).map((rule): ValidacaoRegra => {
    const ativado = !(rule.value === false || rule.value === 0);
    const mensagem = firstString(rule, ["customMessage"]) || undefined;
    const tipo = firstString(rule, ["name"]) ?? String(rule.key ?? "Regra");
    switch (rule.key) {
      case "custom":
        return { tipo, ativado, mensagem, codigo: typeof rule.value === "string" ? rule.value : undefined };
      case "pattern":
        return { tipo, ativado, mensagem, valor: typeof rule.value === "string" ? rule.value : undefined, inverter: rule.reverse === true };
      case "required":
        return { tipo, ativado, mensagem };
      default:
        return { tipo, ativado, mensagem, valor: rule.value !== undefined && rule.value !== null ? String(rule.value) : undefined };
    }
  });
}

/** Builds the "Dados" tab: which of Valor padrão simples/dinâmico/Fonte externa is set
 *  (`data_type` 1/2/3, confirmed against a field showing `data_type: 2` + `data_value:
 *  "nomeCandidato"` matching its builder screen's "Valor padrão dinâmico" / "Nome do parâmetro"),
 *  the "Opções predefinidas" 3-way source (TOTVS/Fonte externa/Manual), and "Somente leitura". */
function buildCampoDados(item: Raw, fieldCatalog: Map<number, string>): CampoDetalhado["dados"] {
  const dataType = Number(item.data_type);
  const tipoValorPadrao = dataType === 1 ? "simples" : dataType === 2 ? "dinamico" : dataType === 3 ? "externa" : undefined;
  const valorPadrao = firstString(item, ["data_value"]);

  const externalSource = item.external_source as Raw | undefined;
  const fonteExterna = externalSource
    ? {
        tipoEnvio: externalSource.http_methods_type_id != null ? String(externalSource.http_methods_type_id) : undefined,
        link: firstString(externalSource, ["link"]),
        salvaAutomaticamente: !!externalSource.is_predefined_option,
        enviaParametros: asArray(externalSource.parameters).length > 0,
        parametros: asArray(externalSource.parameters).map((p) => ({
          nome: firstString(p, ["name"]) ?? "(parâmetro)",
          regra: p.fixed_param === 1 ? "valor fixo" : undefined,
          campoVinculado: formatFieldRefOptional(p.field_id, fieldCatalog),
        })),
      }
    : undefined;

  const manualOptions = asArray(item.manual_options);
  let fonte: "TOTVS" | "Fonte externa" | "Manual" | undefined;
  if (item.defined_source) fonte = "TOTVS";
  else if (item.predefined_external_source) fonte = "Fonte externa";
  else if (manualOptions.length > 0) fonte = "Manual";

  return {
    tipoValorPadrao,
    valorPadrao,
    fonteExterna,
    opcoesPredefinidas: item.predefined_options
      ? {
          ativado: true,
          fonte,
          consultaConfigurada: !!item.defined_source && !!firstString(item, ["totvs_query"]),
          opcoesManuais: manualOptions.length > 0 ? manualOptions.map((o) => ({ label: firstString(o, ["label"]) ?? "", value: firstString(o, ["value"]) ?? "" })) : undefined,
        }
      : { ativado: false, consultaConfigurada: false },
    somenteLeitura: item.read_only === 1,
  };
}

/** Builds the full "Edição do campo" detail — Identidade/Básico/Validação/Dados/Propriedades/
 *  Vínculos — straight from the same raw record already present in `content[]` (its shape is
 *  identical to `GET /api/settings/field/{id}`, confirmed by diffing the two live). */
function buildCampoDetalhado(item: Raw, formBuild: Raw, formioType: string, fieldCatalog: Map<number, string>): CampoDetalhado {
  // `rubeus_table` is a 0/1 flag ("Contato"/"Registro" — the two radio options on "Tabela
  // Rubeus" in the builder), not a free-text table name like TOTVS's — unlike `totvs_table`.
  const rubeusTable = item.rubeus_table === 1 ? "Registro" : item.rubeus_table === 0 ? "Contato" : undefined;
  const rubeusField = firstString(item, ["rubeus_field"]);
  const totvsTable = firstString(item, ["totvs_table"]);
  const totvsField = firstString(item, ["totvs_field"]);
  const multivalorado = item.multivalued === 1;

  return {
    identidade: {
      tipoCampo: FIELD_TYPE_LABELS[formioType] ?? formioType,
      tabelaProcessoSeletivo: item.ps_table === 1 ? "Inscrição" : item.ps_table === 0 ? "Pessoa" : undefined,
      multivalorado: item.multivalued === 1,
      integracaoRubeus: rubeusField ? { ativada: true, tabela: rubeusTable, coluna: rubeusField } : { ativada: false },
      integracaoTotvs: totvsTable || totvsField ? { ativada: true, tabela: totvsTable, campo: totvsField, nomeAlternativo: firstString(item, ["totvs_alternative_name"]) } : { ativada: false },
    },
    basico: {
      rotulo: firstString(formBuild, ["label"]),
      placeholder: firstString(formBuild, ["placeholder"]),
      posicaoRotulo: firstString(formBuild, ["labelPosition"]),
      transformarTexto: firstString(formBuild, ["case"]),
      descricao: firstString(formBuild, ["description"]),
      dica: firstString(formBuild, ["tooltip"]),
      mascara: firstString(formBuild, ["inputMask"]),
      sufixo: firstString(formBuild, ["suffix"]),
      prefixo: firstString(formBuild, ["prefix"]),
      classeCss: firstString(formBuild, ["customClass"]),
      desabilitar: formBuild.disabled === true,
      esconder: formBuild.hidden === true,
      esconderRotulo: formBuild.hideLabel === true,
    },
    multivalorado: multivalorado ? { minOpcoes: item.min_multivalued_options != null ? Number(item.min_multivalued_options) : undefined, maxOpcoes: item.max_multivalued_options != null ? Number(item.max_multivalued_options) : undefined } : undefined,
    validacoes: mapValidationRules(formBuild),
    dados: buildCampoDados(item, fieldCatalog),
    propriedades: (formBuild.properties as Record<string, string> | undefined) ?? {},
    vinculos: asArray(item.field_relation)
      .map((r) => firstString(r, ["label"]))
      .filter((v): v is string => !!v),
  };
}

/** Maps one content/component item (and, for containers, its children in `filhos`) into the
 *  unified `ItemSpec`. Dispatch uses the FORM.IO type inside `form_build` where it disagrees with
 *  the outer envelope `type` — a display-only text block has outer `type: "text"` but
 *  `form_build.type: "content"`, which would otherwise get misclassified as a real input field. */
/** `style` ("btn-raised"/"btn-outline"/other) -> friendly name with the technical name in
 *  parens, e.g. "Elevado (btn-raised)" — "Elevado"/"btn-raised" confirmed live; "Traçado"/
 *  "btn-outline" and "Básico" (default/empty) are per the user's own listing, not yet confirmed
 *  against a real `style` value other than btn-raised. */
const BUTTON_STYLE_LABELS: Record<string, string> = {
  "btn-raised": "Elevado",
  "btn-outline": "Traçado",
};

function describeButtonStyle(style: string | undefined): string | undefined {
  if (!style) return "Básico";
  const label = BUTTON_STYLE_LABELS[style];
  return label ? `${label} (${style})` : style;
}

/** An agrupamento's own `name`/`label` — confirmed live (`POST /selected-stage`): `label` is the
 *  generic component-TYPE label (almost always literally "Agrupamento", regardless of how the
 *  container was actually configured), while `name` is the one the builder user actually typed for
 *  THIS instance (e.g. "Campos", "LGPD", "Dados do candidato"). Showing `label` alone (the old
 *  behavior) made every agrupamento in a stage read as the same bare "Agrupamento" with nothing to
 *  tell them apart — per explicit instruction, always show **name (label)** instead. */
function describeAgrupamentoNome(raw: Raw, fallback: string): string {
  const label = firstString(raw, ["label"]);
  const name = firstString(raw, ["name"]);
  if (name && label) return `${name} (${label})`;
  return name ?? label ?? fallback;
}

/** An agrupamento's background — `container_background_type` (0 = cor sólida, 1 = imagem),
 *  `container_background_color`, `container_background_image` (a storage path — never shown
 *  directly, only "possui imagem vinculada", per explicit instruction). Each of the three is
 *  included only when its own raw value isn't null; returns `undefined` entirely when none are set,
 *  so the caller can skip the whole "Background" line instead of showing an empty one. */
function describeBackground(item: Raw): BackgroundAgrupamentoSpec | undefined {
  const rawTipo = item.container_background_type;
  const tipo = rawTipo === 0 ? "Cor sólida" : rawTipo === 1 ? "Imagem" : undefined;
  const cor = firstString(item, ["container_background_color"]);
  const possuiImagemVinculada = item.container_background_image !== null && item.container_background_image !== undefined && item.container_background_image !== "" ? true : undefined;
  if (!tipo && !cor && !possuiImagemVinculada) return undefined;
  return { tipo, cor, possuiImagemVinculada };
}

/** Exported so a raw record with the same shape (e.g. `GET /api/settings/field/{id}`, confirmed
 *  identical to a `content` item — see the comment above `parseEtapa`) can be parsed standalone,
 *  outside of a stage's own passo tree — used by the portal-level "Geral" section to describe
 *  `course_field_id`/`local_offer_field_id` the same way a normal campo is documented. */
export function mapItem(item: Raw, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): ItemSpec {
  const formBuild = parseFormBuild(item.form_build);
  const outerType = firstString(item, ["type"]) ?? "desconhecido";
  const formioType = firstString(formBuild, ["type"]) ?? outerType;
  const nome = firstString(item, ["label", "name"]) ?? firstString(formBuild, ["label", "name"]) ?? "(sem nome)";

  const base: ItemSpec = {
    categoria: "componente",
    nome,
    tipo: formioType,
    classeCss: firstString(formBuild, ["customClass"]),
    padding: firstString(item, ["padding"]) ?? undefined,
    larguraMaxima: firstString(item, ["max_width"]) ?? undefined,
    alinhamento: describeAlignment(item),
    background: describeBackground(item),
    cssCodigo: firstString(item, ["container_css"]),
    logica: describeLogica(item, fieldCatalog, "elemento"),
    integracaoTotvs: describeTotvsIntegration(item),
  };

  if (outerType === "button") {
    const allActions = mapButtonActionGroups(item, fieldCatalog, catalogs);
    return {
      ...base,
      categoria: "botao",
      nomeComponente: firstString(item, ["name"]),
      tema: describeButtonStyle(firstString(formBuild, ["style"])),
      corBotao: firstString(formBuild, ["externalColor"]),
      corTexto: firstString(formBuild, ["internalColor"]),
      usaCorInstitucional: firstString(formBuild, ["externalColor"]) === "default",
      temIcone: !!(firstString(formBuild, ["leftIcon"]) || firstString(formBuild, ["rightIcon"])),
      escondido: formBuild.hidden === true,
      salvaDados: item.store_data === 1,
      fecharPopup: item.close_popup === 1,
      redirecionaUsuario: item.forward_user === 1,
      acoesPrimeiroPlano: allActions.filter((a) => a.plano === "primeiro"),
      acoesSegundoPlano: allActions.filter((a) => a.plano === "segundo"),
      encaminhamentos: mapForwardData(item, fieldCatalog, catalogs),
    };
  }

  if (outerType === "html") {
    return {
      ...base,
      categoria: "html",
      tipoHtml: firstString(formBuild, ["tag"]) === "script" ? "script" : "html",
      conteudoHtml: firstString(formBuild, ["content"]) ?? "",
    };
  }

  if (outerType === "upload") {
    return {
      ...base,
      categoria: "upload",
      tamanhoMaximoMb: item.upload_max_size ? Number(item.upload_max_size) : undefined,
      multiplosArquivos: item.upload_multiple_files === 1,
      extensoesBloqueadas: item.block_attaching_reject_files === 1,
      camposVinculadosUpload: resolveUploadTargets(item, fieldCatalog),
    };
  }

  if (outerType === "container" || formioType === "fieldset") {
    const children = asArray(item.container_content);
    const filhos = children.map((child) => mapItem(child, fieldCatalog, catalogs));
    // Per explicit instruction: instead of describing the container's column layout (widths,
    // counts — unreliable to recover from `container_content`'s flat, stacked-fields shape), just
    // list the "Label (id)" of every direct child field, same "Label (id)" convention used
    // everywhere else (`formatFieldRef`) — falls back to the child's own raw label when it isn't a
    // resolvable system field (e.g. a nested button/text block). A nested agrupamento child has no
    // `field_id` and defaults its own `name` to the generic "Agrupamento" when never renamed in the
    // builder (confirmed live: several sibling agrupamentos all showing bare "Agrupamento" with
    // nothing to tell them apart) — its own `logics` (display condition) is what actually
    // distinguishes it, so it's carried along per explicit instruction.
    const camposAgrupados: CampoAgrupadoSpec[] = children.map((c) => {
      const fieldId = Number(c.field_id);
      let nome: string;
      if (fieldId) {
        nome = formatFieldRef(fieldId, fieldCatalog);
      } else {
        const childFormBuild = parseFormBuild(c.form_build);
        nome = describeAgrupamentoNome(c, firstString(childFormBuild, ["label", "name"]) ?? "(sem nome)");
      }
      return { nome, logica: describeLogica(c, fieldCatalog, "elemento") };
    });
    return {
      ...base,
      nome: describeAgrupamentoNome(item, nome),
      categoria: "agrupamento",
      camposAgrupados: camposAgrupados.length > 0 ? camposAgrupados : undefined,
      filhos,
    };
  }

  if (item.field_id_to_save_cep) {
    return {
      ...base,
      categoria: "cep",
      campoCepVinculado: formatFieldRef(item.field_id_to_save_cep, fieldCatalog),
      editavel: item.read_only !== 1,
    };
  }

  if (formioType === "content") {
    return {
      ...base,
      categoria: "texto",
      conteudoHtml: firstString(formBuild, ["html"]) ? stripHtml(formBuild.html as string) : nome,
    };
  }

  const validacoes = mapValidationRules(formBuild);
  return {
    ...base,
    categoria: "campo",
    obrigatorio: validacoes.some((v) => v.tipo.toLowerCase().includes("obrigat") && v.ativado),
    regras: validacoes.filter((v) => v.ativado).map((v) => (v.mensagem ? `${v.tipo} (${v.mensagem})` : v.tipo)),
    detalhes: buildCampoDetalhado(item, formBuild, formioType, fieldCatalog),
  };
}

function mapPasso(nome: string, content: Raw[], fieldCatalog: Map<number, string>, catalogs: ActionCatalogs, consultaSql: ConsultaSqlSpec): PassoSpec {
  return { nome, itens: content.map((item) => mapItem(item, fieldCatalog, catalogs)), consultaSql };
}

function mapFeedbacks(feedbackPayload: unknown, fieldCatalog: Map<number, string>): FeedbackSpec[] {
  const list = asArray(unwrapData(feedbackPayload));
  return list.map((fb) => {
    const isFallback = asArray(fb.logics).length === 0;
    return {
      nome: firstString(fb, ["complementary_text"]) ?? "Feedback",
      condicao: isFallback
        ? "Sem condição própria — exibido quando nenhum outro feedback da etapa se aplica."
        : (logicsToText(describeLogicsStructured(fb.logics, fieldCatalog)) ?? "(condição não identificada)"),
      conclusivo: fb.conclusive === 1 || fb.conclusive === true,
    };
  });
}

export interface StageRef {
  list: Raw;
  name: string;
  ativa: boolean;
  steps: { id: number; name: string }[];
  logics: unknown;
}

export interface EtapaParseResult {
  etapa: EtapaSpec;
  warnings: string[];
}

/** Walks a stage's raw `content`/`standard_fields` tree — recursing into every array/object it
 *  finds, since a field can sit behind any depth of `container_content` nesting (agrupamentos
 *  inside agrupamentos, columns inside columns) — collecting every `{field_id, label}` pair it
 *  sees along the way. Confirmed live: each field/component record in `selected-stage` already
 *  carries its OWN `field_id` + `label` inline (the same shape as `GET /api/settings/field/{id}`,
 *  per the comment on `parseSelectiveProcessStructure` above), which is how `field_compare_id`s
 *  like a container's display logic get resolved even when `POST /standard-fields` (the base
 *  catalog) never mentions that id — that endpoint only covers a subset of the fields actually
 *  used across a process's stages. */
export function harvestFieldLabels(nodes: unknown): Map<number, string> {
  const harvested = new Map<number, string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Raw;
    const id = Number(obj.field_id);
    const label = firstString(obj, ["label"]);
    if (id && label && !harvested.has(id)) harvested.set(id, label);
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(nodes);
  return harvested;
}

/** Parses ONE stage into one `EtapaSpec` — split out from the full-process parser so the caller
 *  (the "Documentação PS" page) can fetch and render etapas one at a time as they come back,
 *  instead of waiting for every stage before showing anything. */
export function parseEtapa(stage: StageRef, payload: StagePayload, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs = EMPTY_CATALOGS): EtapaParseResult {
  const warnings: string[] = [];
  const stepsWithContent = asArray(unwrapData(payload?.selectedStage));

  // Base catalog (`POST /standard-fields`) enriched with every `field_id -> label` pair harvested
  // from this stage's own payload, so a `field_compare_id`/`field_id_to_save_*` reference that
  // points at a field defined only inside this stage (not in the base catalog) still resolves to
  // a real name instead of falling back to "campo #id". The base catalog wins on overlap — it's
  // the confirmed-reliable source; harvested entries only fill the gaps it doesn't cover.
  const harvested = harvestFieldLabels(stepsWithContent);
  const enrichedCatalog = harvested.size > 0 ? new Map([...harvested, ...fieldCatalog]) : fieldCatalog;

  const passos: PassoSpec[] = stepsWithContent.map((step, index) => {
    const stepName = firstString(step, ["name"]) ?? "(passo sem nome)";
    const content = asArray(step.content);
    if (content.length === 0) warnings.push(`Passo "${stepName}" da etapa "${stage.name}" não retornou campos/componentes.`);
    const stepId = Number(step.id) || stage.steps[index]?.id;
    const consultaSqlPasso = buildConsultaSql(stepId ? payload?.stepQueries?.[stepId] : undefined, enrichedCatalog);
    return mapPasso(stepName, content, enrichedCatalog, catalogs, consultaSqlPasso);
  });

  if (passos.length === 0) warnings.push(`Etapa "${stage.name}" não retornou passos com conteúdo — verifique se o Token PS ainda é válido.`);

  const etapa: EtapaSpec = {
    nome: stage.name,
    ativa: stage.ativa,
    logicaExibicao: describeLogica(stage.list, enrichedCatalog, "elemento") ?? { regras: [] },
    descricao: passos.length > 0 ? `Etapa composta por ${passos.length} passo(s): ${passos.map((p) => p.nome).join(", ")}.` : "(sem passos identificados)",
    consultaSql: buildConsultaSql(payload?.stageQuery, enrichedCatalog),
    passos,
    feedbacks: mapFeedbacks(payload?.feedback, enrichedCatalog),
  };

  return { etapa, warnings };
}

export function extractTituloPortal(rawProcess: unknown, idPs: string): string {
  const process = unwrapData(rawProcess) as Raw;
  return firstString(process ?? {}, ["name", "nome", "selective_process_name", "title"]) ?? `Processo Seletivo ${idPs}`;
}

export function parseSelectiveProcessStructure(
  idPs: string,
  rawProcess: unknown,
  stages: StageRef[],
  stagePayloads: StagePayload[],
  fieldCatalog: Map<number, string>,
  catalogs: ActionCatalogs = EMPTY_CATALOGS
): ParseResult {
  const warnings: string[] = [];
  const tituloPortal = extractTituloPortal(rawProcess, idPs);

  const etapas: EtapaSpec[] = stages.map((stage, index) => {
    const { etapa, warnings: stageWarnings } = parseEtapa(stage, stagePayloads[index], fieldCatalog, catalogs);
    warnings.push(...stageWarnings);
    return etapa;
  });

  if (etapas.length === 0) warnings.push("Nenhuma etapa ativa foi encontrada na resposta da API.");

  return { model: { tituloPortal, idPs, etapas }, warnings };
}
