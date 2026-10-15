import { unwrapData, asArray, type Raw } from "@/lib/ps-docs/api-helpers";
import { buildIdTitleCatalog, buildFieldCatalog, formatFieldRefOptional, formatCacheInterval, parsePopup, mapItem, EMPTY_CATALOGS } from "@/lib/ps-docs/parse-structure";
import type { PortalOverviewSpec, PortalConsultaSpec, PortalIntegracaoSpec, PortalSegurancaCampoSpec, PortalGeralSpec, PortalApplymentDetailFieldSpec, PortalCampoResumo, PortalProcessRef } from "@/lib/ps-docs/types";
import { ADMIN_API } from "./process-structure";
import { httpError, type RubeusClient } from "./rubeus-client";

/** HTTP + parse core of a whole portal, shared by the "Gerar documentação" Server Actions
 *  (`actions/integrations/ps-portal-docs.ts`, which documents the confirmed API contract) and the
 *  "Buscar elementos" sweep. `pages`/`standard-fields` are environment-wide, so a sweep over many
 *  portals downloads them once through the shared `RubeusClient`. */

const API_ROOT = ADMIN_API;

function firstString(obj: Raw, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/** `GET /api/settings/field/{id}` is confirmed elsewhere (see `parse-structure.ts`) to share the
 *  exact shape of a stage's own `content` item — best-effort: a failed/missing field just leaves
 *  the section absent instead of blocking the rest of the overview. */
async function fetchCampoResumo(fieldId: unknown, client: RubeusClient, fieldCatalog: Map<number, string>, warnings: string[], label: string): Promise<PortalCampoResumo | undefined> {
  const id = typeof fieldId === "number" ? fieldId : typeof fieldId === "string" ? Number(fieldId) : undefined;
  if (!id) return undefined;
  try {
    const res = await client.get(`${API_ROOT}/settings/field/${id}`);
    if (res.status >= 400) {
      warnings.push(`${label}: falha ao consultar o campo #${id} (HTTP ${res.status})`);
      return undefined;
    }
    const raw = unwrapData(res.data) as Raw;
    const item = mapItem(raw, fieldCatalog, EMPTY_CATALOGS);
    if (!item.detalhes) {
      warnings.push(`${label}: campo #${id} não é um campo de formulário válido`);
      return undefined;
    }
    return { nome: item.nome, detalhes: item.detalhes };
  } catch {
    warnings.push(`${label}: falha ao consultar o campo #${id}`);
    return undefined;
  }
}

/** Throws (with an HTTP status) when `portal/general` itself fails. */
export async function loadPortalOverview(client: RubeusClient, idPortal: string, localId: number): Promise<PortalOverviewSpec> {
  const [generalRes, queriesRes, scriptsRes, integrationsRes, securityRes, domainRes, totvsRes, pagesRes, standardFieldsRes] = await Promise.all([
    client.get(`${API_ROOT}/portal/general/${idPortal}`),
    client.post(`${API_ROOT}/settings/totvs-query/list`, { local_id: localId, portal_id: idPortal }),
    client.get(`${API_ROOT}/settings/scripts/portal/${idPortal}`),
    client.get(`${API_ROOT}/settings/integrations/totvs-integrator/portal/${idPortal}`),
    client.get(`${API_ROOT}/portal/login-settings/${idPortal}`),
    client.get(`${API_ROOT}/portal/domain/${idPortal}`),
    client.get(`${API_ROOT}/portal/totvs/${idPortal}`),
    client.get(`${API_ROOT}/pages`),
    // Catálogo `field_id -> label` para o "Campo do sistema" de cada parâmetro de consulta — o
    // mesmo `standard-fields` de `loadProcessStages` (deduplicado pelo client numa varredura).
    client.post(`${API_ROOT}/selective-process/standard-fields`, null, { timeout: 60_000 }),
  ]);

  if (generalRes.status >= 400) throw httpError(generalRes.status, "portal/general");

  const warnings: string[] = [];
  const checkCatalog = (label: string, res: { status: number }) => {
    if (res.status >= 400) warnings.push(`"${label}" indisponível (HTTP ${res.status}).`);
  };
  checkCatalog("Consultas TOTVS", queriesRes);
  checkCatalog("Scripts", scriptsRes);
  checkCatalog("Integrações", integrationsRes);
  checkCatalog("Segurança", securityRes);
  checkCatalog("Domínio", domainRes);
  checkCatalog("TOTVS", totvsRes);
  checkCatalog("Páginas", pagesRes);
  checkCatalog("Campos do sistema (standard-fields)", standardFieldsRes);

  const general = unwrapData(generalRes.data) as Raw;
  const pageCatalog = buildIdTitleCatalog(pagesRes.status < 400 ? pagesRes.data : undefined);
  const fieldCatalog = buildFieldCatalog(standardFieldsRes.status < 400 ? standardFieldsRes.data : undefined);

  const resolvePagina = (pageId: unknown) => {
    const id = typeof pageId === "number" ? pageId : typeof pageId === "string" ? Number(pageId) : undefined;
    if (!id) return undefined;
    const nome = pageCatalog.get(id);
    if (!nome) {
      warnings.push(`Página #${id} não encontrada no catálogo de páginas.`);
      return undefined;
    }
    // A API não expõe um endpoint de detalhe/descrição isolado para uma página (confirmado: só
    // `GET /api/pages` retorna a lista) — a "explicação completa" fica limitada ao nome resolvido.
    return { nome, descricao: `Página "${nome}" configurada no portal.` };
  };

  const headerAtivo = general.header_message_active === 1;

  const [popupLgpd, campoRegistro, campoOfertaCurso, campoLocalOferta] = await Promise.all([
    (async () => {
      const popupId = general.lgpd_popup_id;
      const id = typeof popupId === "number" ? popupId : typeof popupId === "string" ? Number(popupId) : undefined;
      if (!id) return undefined;
      try {
        const [popupRes, queryRes] = await Promise.all([client.get(`${API_ROOT}/popups/${id}`), client.get(`${API_ROOT}/popups/querys/${id}`)]);
        if (popupRes.status >= 400) {
          warnings.push(`Pop-up LGPD #${id}: falha ao consultar (HTTP ${popupRes.status}).`);
          return undefined;
        }
        const parsed = parsePopup(popupRes.data, queryRes.status < 400 ? queryRes.data : undefined, new Map(), EMPTY_CATALOGS);
        return { nome: parsed.nome, permiteFechar: parsed.permiteFechar, itens: parsed.itens, consultaSql: parsed.consultaSql };
      } catch {
        warnings.push(`Pop-up LGPD #${id}: falha ao consultar.`);
        return undefined;
      }
    })(),
    fetchCampoResumo(general.register_field_id, client, fieldCatalog, warnings, "Campo de código do registro"),
    fetchCampoResumo(general.course_field_id, client, fieldCatalog, warnings, "Campo de oferta de curso"),
    fetchCampoResumo(general.local_offer_field_id, client, fieldCatalog, warnings, "Campo de local de oferta"),
  ]);

  const camposDetalhesInscricao: PortalApplymentDetailFieldSpec[] = asArray(general.applyment_details_fields)
    .map((f) => {
      const typeId = Number(f.parameter_type_id);
      const tipo = typeId === 1 ? "Campo do sistema" : typeId === 2 ? "Valor fixo" : typeId === 4 ? "Consulta" : `Tipo ${f.parameter_type_id ?? "?"}`;
      return {
        nome: firstString(f, ["name"]) ?? "",
        tipo,
        posicao: Number(f.position) || 0,
        alias: typeId === 4 ? firstString(f, ["alias"]) : undefined,
        valorFixo: typeId === 2 ? firstString(f, ["fixed_value"]) : undefined,
        campoSistema: typeId === 1 ? formatFieldRefOptional(f.field_id, fieldCatalog) : undefined,
      };
    })
    .sort((a, b) => a.posicao - b.posicao);

  const geral: PortalGeralSpec = {
    nome: firstString(general, ["name"]) ?? `Portal ${idPortal}`,
    titulo: firstString(general, ["title"]) ?? "",
    ativo: general.status === 1,
    paginaEdicaoInscricao: resolvePagina(general.applyment_edit_page_id),
    paginaDetalhesUsuario: resolvePagina(general.user_details_page_id),
    carregamentoInteligente: general.disable_loaders === 1,
    vlibrasAtivo: general.enable_Vlibras === 1,
    cabecalhoAtivo: headerAtivo,
    cabecalhoTexto: headerAtivo ? firstString(general, ["header_message"]) : undefined,
    popupLgpd,
    linkLogoff: firstString(general, ["log_off_link"]),
    campoRegistro,
    campoOfertaCurso,
    campoLocalOferta,
    camposDetalhesInscricao: camposDetalhesInscricao.length > 0 ? camposDetalhesInscricao : undefined,
    tituloSelectInscricoes: firstString(general, ["open_processes_title"]) ?? "",
    tituloBarraEtapas: firstString(general, ["title"]) ?? "",
    tituloBarraPortalInscrito: firstString(general, ["title_register_portal"]) ?? "",
  };

  const consultas: PortalConsultaSpec[] = queriesRes.status < 400
    ? asArray(unwrapData(queriesRes.data)).map((q) => ({
        codigo: firstString(q, ["code"]) ?? "",
        coligada: firstString(q, ["colligate"]) ?? "",
        sistema: firstString(q, ["system"]) ?? "",
        descricao: firstString(q, ["description"]) ?? "",
        // `context` referencia o campo do sistema pelo mesmo `field_id` numérico que `parameters`
        // usa — mesma resolução via `fieldCatalog`, nunca por uma chave `field`/`campo` (que não
        // existe no payload real).
        contexto: asArray(q.context).length > 0 ? asArray(q.context).map((c) => ({ nome: firstString(c, ["name", "nome"]) ?? "", campoVinculado: formatFieldRefOptional(c.field_id, fieldCatalog) })) : undefined,
        // Confirmado no payload real (`POST /settings/totvs-query/list`): o discriminador
        // campo-do-sistema/valor-fixo é `parameter_type_id` (1 = campo do sistema, 2 = valor
        // fixo) — o MESMO usado em `buildConsultaSql` (`lib/ps-docs/parse-structure.ts`) para
        // `get-stage-querys`/`step/querys`. `fixed_param` NÃO é confiável aqui: um parâmetro real
        // com `field_id` preenchido e `fixed_param: 1` foi confirmado como "Campo do sistema" (o
        // próprio endpoint retorna esse `fixed_param` inconsistente com o tipo real do parâmetro).
        // O campo do sistema é `field_id` (numérico, resolvido via `standard-fields`), e o valor
        // fixo é `fixed_value` — não `field`/`campo`/`value`/`valor`, que não existem nesse
        // endpoint.
        parametros: asArray(q.parameters).map((p) => {
          const isValorFixo = Number(p.parameter_type_id) === 2;
          return {
            nome: firstString(p, ["name", "nome"]) ?? "",
            tipo: isValorFixo ? ("Valor fixo" as const) : ("Campo do sistema" as const),
            campoSistema: !isValorFixo ? formatFieldRefOptional(p.field_id, fieldCatalog) : undefined,
            valorFixo: isValorFixo ? firstString(p, ["fixed_value"]) : undefined,
          };
        }),
        ativa: q.status === 1,
        usaCache: q.use_cache === true || q.use_cache === 1,
        frequenciaCache: formatCacheInterval(q.cache_interval_type_id),
      }))
    : [];

  const scriptsRaw = scriptsRes.status < 400 ? (unwrapData(scriptsRes.data) as Raw) : {};
  const scripts = {
    gtagCode: firstString(scriptsRaw, ["gtag_code"]),
    scriptBody: firstString(scriptsRaw, ["script_body"]),
    scriptBodyComCookies: scriptsRaw.script_body_with_cookies === 1 || scriptsRaw.script_body_with_cookies === true,
    scriptHead: firstString(scriptsRaw, ["script_head"]),
    scriptHeadComCookies: scriptsRaw.script_head_with_cookies === 1 || scriptsRaw.script_head_with_cookies === true,
  };

  const integracoes: PortalIntegracaoSpec[] = integrationsRes.status < 400
    ? asArray(unwrapData(integrationsRes.data))
        .map(
          (i): PortalIntegracaoSpec => ({
            posicao: Number(i.position ?? 0),
            coligada: firstString(i, ["colligate"]) ?? "",
            sistema: firstString(i, ["system"]) ?? "",
            query: firstString(i, ["query"]) ?? "",
            descricao: firstString(i, ["description"]) ?? "",
            tbc: firstString(i, ["tbc"]),
            codigoExterno: firstString(i, ["external_code"]) ?? "",
          })
        )
        .sort((a, b) => a.posicao - b.posicao)
    : [];

  const seguranca: PortalSegurancaCampoSpec[] = securityRes.status < 400
    ? asArray((unwrapData(securityRes.data) as Raw).fields).map((f) => ({ label: firstString(f, ["label"]) ?? "", tipo: firstString(f, ["type"]) ?? "" }))
    : [];

  const domainRaw = domainRes.status < 400 ? (unwrapData(domainRes.data) as Raw) : undefined;
  const dominio =
    domainRaw?.domain === 1
      ? ({ tipo: "proprio" as const, dominioProprio: firstString(domainRaw, ["client_domain"]) ?? "" })
      : domainRaw
      ? ({ tipo: "sistema" as const, dominioSistema: firstString(domainRaw, ["system_domain"]) ?? "" })
      : undefined;

  const totvsRaw = totvsRes.status < 400 ? (unwrapData(totvsRes.data) as Raw) : {};
  const totvs = {
    tbc: firstString(totvsRaw, ["tbc"]) ?? "",
    usuario: firstString(totvsRaw, ["totvs_user"]) ?? "",
    codColigada: firstString(totvsRaw, ["cod_coligate"]) ?? "",
    codFilial: firstString(totvsRaw, ["cod_affiliate"]) ?? "",
    codSistema: firstString(totvsRaw, ["cod_system"]) ?? "",
    codTipoCurso: firstString(totvsRaw, ["cod_course_type"]) ?? "",
  };

  return { idPortal, geral, consultas, scripts, integracoes, seguranca, dominio, totvs, warnings };
}

/** Active processes of a portal (`status === 1`). Throws when the list can't be read. */
export async function listPortalProcesses(client: RubeusClient, idPortal: string): Promise<{ total: number; processes: PortalProcessRef[] }> {
  const res = await client.get(`${API_ROOT}/portal/selective-process-local/${idPortal}`);
  if (res.status >= 400) throw httpError(res.status, "selective-process-local");
  const all = asArray(unwrapData(res.data));
  const processes = all
    .filter((p) => p.status === 1)
    .map((p) => ({ id: String(p.id), identifier: firstString(p, ["identifier"]) ?? String(p.id), name: firstString(p, ["name"]) ?? "(processo sem nome)" }));
  return { total: all.length, processes };
}

/** Status flag of a `GET /api/portal` entry — `status === 1` like the processes; the other keys
 *  are accepted defensively (shape not confirmed). `undefined` when the entry carries none. */
function portalActive(entry: Raw): boolean | undefined {
  if (entry.status !== undefined && entry.status !== null) return Number(entry.status) === 1 || entry.status === true || entry.status === "active";
  for (const key of ["active", "is_active", "ativo"]) {
    const value = entry[key];
    if (value !== undefined && value !== null) return value === true || Number(value) === 1;
  }
  return undefined;
}

/** `GET /api/portal` — every portal of the environment, keeping the active ones. When no entry
 *  says whether it's active, all are kept and `warning` says so. Throws when the list fails. */
export async function listActivePortals(client: RubeusClient): Promise<{ total: number; portals: [number, string][]; warning?: string }> {
  const res = await client.get(`${API_ROOT}/portal`);
  if (res.status >= 400) throw httpError(res.status, "a lista de portais");
  const all = asArray(unwrapData(res.data));
  const flags = all.map(portalActive);
  const hasStatus = flags.some((f) => f !== undefined);
  const portals: [number, string][] = [];
  all.forEach((entry, i) => {
    const id = Number(entry.id);
    if (!Number.isInteger(id) || id <= 0 || (hasStatus && flags[i] !== true)) return;
    portals.push([id, firstString(entry, ["name", "title", "nome"])?.trim() ?? ""]);
  });
  return { total: all.length, portals, warning: hasStatus || all.length === 0 ? undefined : "A lista de portais não informa quais estão ativos — todos os portais foram lidos." };
}
