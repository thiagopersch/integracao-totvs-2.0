import type { Raw } from "./api-helpers";
import {
  buildEventos,
  describeLogica,
  formatCacheInterval,
  formatFieldRefOptional,
  mapForwardData,
  resolveTipoAcao,
  stripHtml,
  type ActionCatalogs,
} from "./parse-structure";
import type { EncaminhamentoSpec, EventoRubeusSpec, LogicaSpec, ParametroAcaoSpec, TipoAcao } from "./types";

/** Full config of ONE component — `GET /api/custom-component/{id}` — shown when a row of "Busca
 *  de campos PS" is expanded. Unlike `ItemSpec` (shaped for the documentation), this stays close
 *  to the raw response: every button_action group with every action, field and parameter. */
export interface ComponentDetail {
  id: number;
  nome: string;
  rotulo?: string;
  tipo: string;
  flags: { label: string; ativo: boolean }[];
  mensagemErro?: string;
  editadoPor?: string;
  atualizadoEm?: string;
  logica?: LogicaSpec;
  consulta?: ComponentQuery;
  grupos: ComponentActionGroup[];
  encaminhamentos: EncaminhamentoSpec[];
}

export interface ComponentQuery {
  titulo?: string;
  codigo: string;
  coligada?: string;
  sistema?: string;
  descricao?: string;
  usaCache: boolean;
  frequenciaCache?: string;
  parametros: ParametroAcaoSpec[];
  contexto: { nome: string; campoVinculado?: string }[];
}

export interface ComponentActionGroup {
  id?: number;
  ordem: number;
  titulo: string;
  tipoGrupo: string;
  ativa: boolean;
  plano: "primeiro" | "segundo";
  mensagemErro?: string;
  acoes: ComponentAction[];
}

export interface ComponentAction {
  id?: number;
  titulo: string;
  tipoAcao: TipoAcao;
  descricao?: string;
  /** Realizar consulta: code/colligate/system; other types: the query behind `identifier`. */
  consulta?: { codigo: string; coligada?: string; sistema?: string; usaCache: boolean; frequenciaCache?: string };
  /** Salvar dados: dataserver; Executar processo: processo — "Nome (#id)". */
  destino?: string;
  repetir?: boolean;
  parametros: ParametroAcaoSpec[];
  campos: ComponentActionField[];
  contexto: { nome: string; campoVinculado?: string }[];
  logica?: LogicaSpec;
  eventos?: EventoRubeusSpec[];
}

export interface ComponentActionField {
  titulo?: string;
  tabela?: string;
  coluna?: string;
  /** System field bound to it, "Label (id)". */
  campo?: string;
  valorFixo?: string;
  descricao?: string;
}

function str(obj: Raw, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function list(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((v): v is Raw => !!v && typeof v === "object");
  if (value && typeof value === "object") return [value as Raw];
  return [];
}

const isOn = (value: unknown) => value === 1 || value === true;

/** Action parameters flag a fixed value with `fixed_param: 1`; query parameters with
 *  `parameter_type_id: 2` (see `buildParametros`/`buildConsultaSql`) — accept either here. */
function mapParametros(raw: Raw, fieldCatalog: Map<number, string>): ParametroAcaoSpec[] {
  return list(raw.parameters).map((p): ParametroAcaoSpec => {
    const nome = str(p, ["name"]) ?? "(parâmetro)";
    if (isOn(p.fixed_param) || Number(p.parameter_type_id) === 2) {
      return { nome, tipo: "Valor fixo", valorFixo: p.fixed_value !== null && p.fixed_value !== undefined ? String(p.fixed_value) : undefined };
    }
    return { nome, tipo: "Campo do sistema", campoSistema: formatFieldRefOptional(p.field_id, fieldCatalog) };
  });
}

function mapContexto(raw: Raw, fieldCatalog: Map<number, string>) {
  return list(raw.context).map((c) => ({
    nome: str(c, ["name", "title", "key"]) ?? "(contexto)",
    campoVinculado: formatFieldRefOptional(c.field_id, fieldCatalog),
  }));
}

/** Both `fields[]` shapes seen live: a Realizar consulta's `{title, key, description, field_id}`
 *  (fields the query fills) and a Salvar dados/Executar processo's `{title, totvs_table,
 *  totvs_column, field_id, fixed_value}` (column ← field or fixed value). */
function mapCampo(f: Raw, fieldCatalog: Map<number, string>): ComponentActionField {
  const fixed = f.fixed_value;
  return {
    titulo: str(f, ["title"]),
    tabela: str(f, ["totvs_table"]),
    coluna: str(f, ["totvs_column", "totvs_field", "rubeus_field"]),
    campo: formatFieldRefOptional(f.field_id, fieldCatalog),
    valorFixo: fixed !== null && fixed !== undefined && fixed !== "" ? String(fixed) : undefined,
    descricao: str(f, ["description"]),
  };
}

function mapQuery(raw: Raw): ComponentAction["consulta"] {
  const codigo = str(raw, ["code", "identifier"]);
  if (!codigo) return undefined;
  return {
    codigo,
    coligada: str(raw, ["colligate"]),
    sistema: str(raw, ["system"]),
    usaCache: isOn(raw.use_cache),
    frequenciaCache: formatCacheInterval(raw.cache_interval_type_id),
  };
}

function mapAction(group: Raw, action: Raw, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): ComponentAction {
  const tipoAcao = resolveTipoAcao(group, action, catalogs.actionTypes);
  let destino: string | undefined;
  if (action.totvs_data_server_type_id) {
    const id = Number(action.totvs_data_server_type_id);
    destino = `${catalogs.dataServerTypes.get(id) ?? "Dataserver"} (#${id})`;
  } else if (action.totvs_process_type_id) {
    const id = Number(action.totvs_process_type_id);
    destino = `${catalogs.processTypes.get(id) ?? "Processo"} (#${id})`;
  }
  return {
    id: Number(action.id) || undefined,
    titulo: str(action, ["title"]) ?? tipoAcao,
    tipoAcao,
    descricao: str(action, ["discription", "description"]),
    consulta: mapQuery(action),
    destino,
    repetir: action.repeat === undefined ? undefined : isOn(action.repeat),
    parametros: mapParametros(action, fieldCatalog),
    campos: list(action.fields).map((f) => mapCampo(f, fieldCatalog)),
    contexto: mapContexto(action, fieldCatalog),
    logica: describeLogica(action, fieldCatalog, "acao"),
    eventos: buildEventos(action, catalogs.rubeusEvents),
  };
}

export function parseComponentDetail(raw: Raw, fieldCatalog: Map<number, string>, catalogs: ActionCatalogs): ComponentDetail {
  const query = raw.totvs_query && typeof raw.totvs_query === "object" ? (raw.totvs_query as Raw) : undefined;
  const consultaCodigo = query ? str(query, ["code"]) : undefined;

  const grupos = list(raw.button_actions)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map(
      (group): ComponentActionGroup => ({
        id: Number(group.id) || undefined,
        ordem: Number(group.position ?? 0),
        titulo: str(group, ["description"]) ? stripHtml(str(group, ["description"])!) : "(ação sem nome)",
        tipoGrupo: str((group.button_actions_type as Raw) ?? {}, ["title"]) ?? str(group, ["title"]) ?? "Ação",
        ativa: isOn(group.status),
        plano: Number(group.execution_group) === 2 ? "segundo" : "primeiro",
        mensagemErro: str(group, ["error_message"]),
        acoes: list(group.actions).map((action) => mapAction(group, action, fieldCatalog, catalogs)),
      })
    );

  return {
    id: Number(raw.id),
    nome: str(raw, ["name"]) ?? "(sem nome)",
    rotulo: str(raw, ["label"]),
    tipo: str(raw, ["type", "key"]) ?? "componente",
    flags: [
      { label: "Salva dados", ativo: isOn(raw.store_data) },
      { label: "Redireciona usuário", ativo: isOn(raw.forward_user) },
      { label: "Fecha pop-up", ativo: isOn(raw.close_popup) },
      { label: "Envia ao TOTVS", ativo: isOn(raw.send_totvs) },
      { label: "Envia ao CRM", ativo: isOn(raw.send_crm) },
      { label: "Gera relatório", ativo: isOn(raw.create_report) },
    ],
    mensagemErro: str(raw, ["error_message"]),
    editadoPor: str(raw, ["name_edited_by"]),
    atualizadoEm: str(raw, ["updated_at"]),
    logica: describeLogica(raw, fieldCatalog, "elemento"),
    consulta:
      query && consultaCodigo
        ? {
            titulo: str(query, ["title"]),
            codigo: consultaCodigo,
            coligada: str(query, ["colligate"]),
            sistema: str(query, ["system"]),
            descricao: str(query, ["description"]),
            usaCache: isOn(query.use_cache),
            frequenciaCache: formatCacheInterval(query.cache_interval_type_id),
            parametros: mapParametros(query, fieldCatalog),
            contexto: mapContexto(query, fieldCatalog),
          }
        : undefined,
    grupos,
    encaminhamentos: mapForwardData(raw, fieldCatalog, catalogs),
  };
}
