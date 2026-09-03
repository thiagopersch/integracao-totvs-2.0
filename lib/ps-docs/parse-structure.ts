import type { AcaoBotaoSpec, DocumentacaoPS, EncaminhamentoSpec, EtapaSpec, FeedbackSpec, FonteDadosSpec, IntegracaoTotvsSpec, ItemSpec, PassoSpec, RegraLogicaItem } from "./types";

/**
 * Maps the raw JSON returned by the Rubeus "processo seletivo" builder API
 * (`admin.portal.apprbs.com.br/api/selective-process/*`) into the documentation model. Confirmed
 * live against two real processes (idPs 5537 and 17869) — see the plan file for the full
 * request/response shapes. The calls that feed this:
 *  - `GET  /opening-page-process/{idPs}`                -> process title
 *  - `GET  /opening-page-stages/{idPs}`                 -> list of stages ("etapas"), each with its
 *    `steps` (id/name only) and its own display `logics` (stage-level visibility rule)
 *  - `POST /standard-fields` (no body)                  -> global field catalog (`field_id -> label`),
 *    fetched once and used to resolve every `field_compare_id`/`field_id_to_save_*` reference
 *  - `POST /selected-stage/{idPs}` body `{stage_id, editor:true}` (one call per stage) -> that
 *    stage's `steps`, now with the real `content` array (fields/components, in display order).
 *    A button's action pipeline lives inline on that button's content item as `button_actions`
 *    (ordered TOTVS/Rubeus action groups — this is the docx's "RB.PS.IM.007 | ..." narrative) and
 *    `forwardData` (redirect/"encaminhar" actions).
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
}

export interface ParseResult {
  model: DocumentacaoPS;
  warnings: string[];
}

/** `rule_logic_id` values observed on real processes, decoded by cross-checking against the
 *  reference .docx's plain-language description of the same rules (e.g. "maior que 4 e menor
 *  que 8" <-> rule_logic_id 5 then 6 on the same field). Unknown ids fall back to a literal id. */
const OPERATOR_LABELS: Record<number, string> = {
  1: "igual a",
  2: "diferente de",
  3: "contém",
  4: "informado (preenchido)",
  5: "maior que",
  6: "menor que",
};

function operatorLabel(ruleLogicId: unknown): string {
  const id = Number(ruleLogicId);
  return OPERATOR_LABELS[id] ?? `regra ${String(ruleLogicId)}`;
}

function asArray(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((v): v is Raw => !!v && typeof v === "object");
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

/** Builds a `field_id -> label` lookup from `POST /standard-fields` (the global system field
 *  catalog, fetched once by the caller). */
export function buildFieldCatalog(standardFieldsPayload: unknown): Map<number, string> {
  const catalog = new Map<number, string>();
  for (const field of asArray(unwrapData(standardFieldsPayload))) {
    const id = Number(field.field_id);
    const label = firstString(field, ["label"]);
    if (id && label) catalog.set(id, label);
  }
  return catalog;
}

function ruleToItem(rule: Raw, fieldCatalog: Map<number, string>): RegraLogicaItem {
  const fieldId = Number(rule.field_compare_id);
  const campo = fieldCatalog.get(fieldId) ?? (fieldId ? `campo #${fieldId}` : "(campo não identificado)");
  const regra = operatorLabel(rule.rule_logic_id);
  const valor = rule.fixed_value === null || rule.fixed_value === undefined || rule.fixed_value === "" ? undefined : String(rule.fixed_value);
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

function describeTotvsIntegration(item: Raw): IntegracaoTotvsSpec | undefined {
  const table = firstString(item, ["totvs_table"]);
  const field = firstString(item, ["totvs_field"]);
  const sentenca = firstString(item, ["totvs_query"]);
  if (!table && !field && !sentenca) return undefined;
  return { tabela: table, campo: field, sentenca };
}

/** Only populated when codColigada + codSistema + codConsulta are ALL present, per explicit
 *  instruction — a query/action that isn't backed by a real TOTVS consulta must not report one.
 *  Field names (`colligate`/`system`/`identifier`/`use_cache`/`cache_interval_type_id`) confirmed
 *  live inside a real button's `button_actions[].actions[]` entry. */
function buildFonteDados(raw: Raw, fieldCatalog: Map<number, string>): FonteDadosSpec | undefined {
  const colligate = raw.colligate;
  const system = raw.system;
  const identifier = raw.identifier;
  if (colligate === null || colligate === undefined || colligate === "") return undefined;
  if (!system) return undefined;
  if (!identifier) return undefined;

  const contexto = asArray(raw.parameters).map((p) => ({
    nome: firstString(p, ["name"]) ?? "(parâmetro)",
    campoVinculado: p.field_id ? fieldCatalog.get(Number(p.field_id)) : undefined,
  }));

  return {
    codColigada: String(colligate),
    codSistema: String(system),
    codConsulta: String(identifier),
    usaCache: raw.use_cache === true || raw.use_cache === 1,
    frequenciaCache: raw.cache_interval_type_id != null ? String(raw.cache_interval_type_id) : undefined,
    contexto,
  };
}

function describeAlignment(item: Raw): string | undefined {
  const parts: string[] = [];
  const direction = firstString(item, ["layout_direction"]);
  const horizontal = firstString(item, ["layout_direction_alignment"]);
  const vertical = firstString(item, ["layout_perpendicular_alignment"]);
  if (direction) parts.push(`direção: ${direction}`);
  if (horizontal) parts.push(`alinhamento horizontal: ${horizontal}`);
  if (vertical) parts.push(`alinhamento vertical: ${vertical}`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function mapButtonActions(item: Raw, fieldCatalog: Map<number, string>): AcaoBotaoSpec[] {
  const groups = asArray(item.button_actions).sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const result: AcaoBotaoSpec[] = [];
  for (const group of groups) {
    const groupTitle = firstString((group.button_actions_type as Raw) ?? {}, ["title"]) ?? "Ação";
    const errorMessage = firstString(group, ["error_message"]);
    const position = Number(group.position ?? 0);
    const ativada = group.status === 1;
    for (const action of asArray(group.actions)) {
      result.push({
        ordem: position,
        grupo: groupTitle,
        descricao: stripHtml(firstString(action, ["discription", "description"]) ?? "(sem descrição)"),
        mensagemErro: errorMessage,
        acaoParametrizada: firstString(action, ["code"]),
        camposConfigurados: asArray(action.fields).map((f) => firstString(f, ["title"]) ?? (f.field_id ? `campo #${f.field_id}` : "(campo)")),
        logica: describeLogicsStructured(action.logics, fieldCatalog),
        ativada,
        fonteDados: buildFonteDados(action, fieldCatalog),
      });
    }
  }
  return result;
}

function mapForwardData(item: Raw, fieldCatalog: Map<number, string>): EncaminhamentoSpec[] {
  return asArray(item.forwardData)
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((fd) => ({
      destino: fd.popup_id ? `Popup #${fd.popup_id}` : fd.page_id ? `Página #${fd.page_id}` : firstString(fd, ["link"]) ?? "(destino não identificado)",
      novaAba: fd.new_tab === 1 || fd.new_tab === true,
      logica: describeLogicsStructured(fd.logics, fieldCatalog),
    }));
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
    targets.push({ papel, campo: fieldCatalog.get(fieldId) ?? `campo #${fieldId}` });
  }
  return targets;
}

/** Maps one content/component item (and, for containers, its children in `filhos`) into the
 *  unified `ItemSpec`. Dispatch uses the FORM.IO type inside `form_build` where it disagrees with
 *  the outer envelope `type` — a display-only text block has outer `type: "text"` but
 *  `form_build.type: "content"`, which would otherwise get misclassified as a real input field. */
function mapItem(item: Raw, fieldCatalog: Map<number, string>): ItemSpec {
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
    temBackground: !!item.container_background_type,
    corBackground: firstString(item, ["container_background_color"]),
    temImagemBackground: !!item.container_background_image,
    cssCodigo: firstString(item, ["container_css"]),
    logica: describeLogicsStructured(item.logics, fieldCatalog),
    integracaoTotvs: describeTotvsIntegration(item),
    fonteDados: buildFonteDados(item, fieldCatalog),
  };
  base.logicaTexto = logicsToText(base.logica);

  if (outerType === "button") {
    return {
      ...base,
      categoria: "botao",
      tema: firstString(formBuild, ["style"]),
      corBotao: firstString(formBuild, ["externalColor"]),
      corTexto: firstString(formBuild, ["internalColor"]),
      usaCorInstitucional: firstString(formBuild, ["externalColor"]) === "default",
      temIcone: !!(firstString(formBuild, ["leftIcon"]) || firstString(formBuild, ["rightIcon"])),
      escondido: formBuild.hidden === true,
      salvaDados: item.store_data === 1,
      redirecionaUsuario: item.forward_user === 1,
      acoes: mapButtonActions(item, fieldCatalog),
      encaminhamentos: mapForwardData(item, fieldCatalog),
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
    const filhos = asArray(item.container_content).map((child) => mapItem(child, fieldCatalog));
    const columnSizes = new Set(asArray(item.container_content).map((c) => firstString(c, ["column_size"])).filter(Boolean));
    return {
      ...base,
      categoria: "agrupamento",
      numColunas: columnSizes.size > 1 ? columnSizes.size : undefined,
      larguraColuna: columnSizes.size === 1 ? [...columnSizes][0] : undefined,
      filhos,
    };
  }

  if (item.field_id_to_save_cep) {
    return {
      ...base,
      categoria: "cep",
      campoCepVinculado: fieldCatalog.get(Number(item.field_id_to_save_cep)) ?? `campo #${item.field_id_to_save_cep}`,
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

  const validatorData = formBuild.validatorData as Raw | undefined;
  const regras: string[] = [];
  if (validatorData && Array.isArray(validatorData.data)) {
    for (const rule of validatorData.data as Raw[]) {
      if (rule.value === false || rule.value === 0) continue;
      const label = firstString(rule, ["name"]) ?? String(rule.key ?? "regra");
      const msg = firstString(rule, ["customMessage"]);
      regras.push(msg ? `${label} (${msg})` : label);
    }
  }
  if ((formBuild.validate as Raw | undefined)?.required) regras.push("Campo obrigatório");

  return {
    ...base,
    categoria: "campo",
    obrigatorio: regras.some((r) => /obrigat/i.test(r)),
    regras,
  };
}

function flattenItems(items: ItemSpec[]): ItemSpec[] {
  return items.flatMap((item) => [item, ...(item.filhos ? flattenItems(item.filhos) : [])]);
}

function collectDataSources(items: ItemSpec[]): string[] {
  const sources = new Set<string>();
  for (const item of flattenItems(items)) {
    if (item.integracaoTotvs?.tabela) sources.add(item.integracaoTotvs.tabela);
  }
  return [...sources];
}

function mapPasso(nome: string, content: Raw[], fieldCatalog: Map<number, string>): PassoSpec {
  return { nome, itens: content.map((item) => mapItem(item, fieldCatalog)) };
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

/** Parses ONE stage into one `EtapaSpec` — split out from the full-process parser so the caller
 *  (the "Documentação PS" page) can fetch and render etapas one at a time as they come back,
 *  instead of waiting for every stage before showing anything. */
export function parseEtapa(stage: StageRef, payload: StagePayload, fieldCatalog: Map<number, string>): EtapaParseResult {
  const warnings: string[] = [];
  const stepsWithContent = asArray(unwrapData(payload?.selectedStage));

  const passos: PassoSpec[] = stepsWithContent.map((step) => {
    const stepName = firstString(step, ["name"]) ?? "(passo sem nome)";
    const content = asArray(step.content);
    if (content.length === 0) warnings.push(`Passo "${stepName}" da etapa "${stage.name}" não retornou campos/componentes.`);
    return mapPasso(stepName, content, fieldCatalog);
  });

  if (passos.length === 0) warnings.push(`Etapa "${stage.name}" não retornou passos com conteúdo — verifique se o Token PS ainda é válido.`);

  const allItens = passos.flatMap((p) => p.itens);

  const etapa: EtapaSpec = {
    nome: stage.name,
    ativa: stage.ativa,
    logicaExibicao: logicsToText(describeLogicsStructured(stage.logics, fieldCatalog)) ?? "Nenhuma restrição de exibição identificada.",
    descricao: passos.length > 0 ? `Etapa composta por ${passos.length} passo(s): ${passos.map((p) => p.nome).join(", ")}.` : "(sem passos identificados)",
    fontesDados: collectDataSources(allItens),
    passos,
    feedbacks: mapFeedbacks(payload?.feedback, fieldCatalog),
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
  fieldCatalog: Map<number, string>
): ParseResult {
  const warnings: string[] = [];
  const tituloPortal = extractTituloPortal(rawProcess, idPs);

  const etapas: EtapaSpec[] = stages.map((stage, index) => {
    const { etapa, warnings: stageWarnings } = parseEtapa(stage, stagePayloads[index], fieldCatalog);
    warnings.push(...stageWarnings);
    return etapa;
  });

  if (etapas.length === 0) warnings.push("Nenhuma etapa ativa foi encontrada na resposta da API.");

  return { model: { tituloPortal, idPs, etapas }, warnings };
}
