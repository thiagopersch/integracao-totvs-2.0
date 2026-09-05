"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { authHeaders, unwrapData, asArray, logApiCall, logAndNotifyFailure, type Raw } from "@/lib/ps-docs/api-helpers";
import { buildIdTitleCatalog, buildFieldCatalog, formatFieldRefOptional, formatCacheInterval, parsePopup, mapItem, EMPTY_CATALOGS } from "@/lib/ps-docs/parse-structure";
import type { PortalOverviewSpec, PortalConsultaSpec, PortalIntegracaoSpec, PortalSegurancaCampoSpec, PortalGeralSpec, PortalCampoResumo, PortalProcessRef } from "@/lib/ps-docs/types";

/**
 * Documents an entire portal — `admin.portal.apprbs.com.br/api/portal/*`, `/api/settings/*` and
 * `/api/pages` — as opposed to a single processo seletivo (see `actions/integrations/ps-docs.ts`).
 * Confirmed against `admin.portal.apprbs.com.br/administrativo/portal/{idPortal}`'s own requests:
 *  - `GET  /api/portal/general/{idPortal}`
 *  - `POST /api/settings/totvs-query/list` body `{ local_id, portal_id }`
 *  - `GET  /api/settings/scripts/portal/{idPortal}`
 *  - `GET  /api/settings/integrations/totvs-integrator/portal/{idPortal}`
 *  - `GET  /api/portal/login-settings/{idPortal}`
 *  - `GET  /api/portal/domain/{idPortal}`
 *  - `GET  /api/portal/totvs/{idPortal}`
 *  - `GET  /api/pages`
 *  - `GET  /api/portal/selective-process-local/{idPortal}` (active processes, documented one by
 *    one afterwards by the existing `listSelectiveProcessStages`/`fetchStageDocumentation`)
 */
const API_ROOT = "https://admin.portal.apprbs.com.br/api";

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
async function fetchCampoResumo(fieldId: unknown, headers: Record<string, string>, fieldCatalog: Map<number, string>, warnings: string[], label: string): Promise<PortalCampoResumo | undefined> {
  const id = typeof fieldId === "number" ? fieldId : typeof fieldId === "string" ? Number(fieldId) : undefined;
  if (!id) return undefined;
  try {
    const res = await axios.get(`${API_ROOT}/settings/field/${id}`, { headers, validateStatus: () => true, timeout: 30_000 });
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

export interface FetchPortalOverviewResult {
  success: boolean;
  error?: string;
  overview?: PortalOverviewSpec;
}

export async function fetchPortalOverview(input: { tokenPs: string; idPortal: string; localId?: string }): Promise<FetchPortalOverviewResult> {
  const { organizationId, userId } = await requirePermission("ps_docs", "execute");

  const idPortal = input.idPortal.trim();
  const tokenPs = input.tokenPs.trim();
  const localId = Number(input.localId?.trim() || "2") || 2;
  if (!idPortal || !tokenPs) return { success: false, error: "Informe o Token PS e o ID do Portal" };

  const headers = authHeaders(tokenPs);
  const generalUrl = `${API_ROOT}/portal/general/${idPortal}`;

  try {
    const [generalRes, queriesRes, scriptsRes, integrationsRes, securityRes, domainRes, totvsRes, pagesRes, standardFieldsRes] = await Promise.all([
      axios.get(generalUrl, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.post(`${API_ROOT}/settings/totvs-query/list`, { local_id: localId, portal_id: idPortal }, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${API_ROOT}/settings/scripts/portal/${idPortal}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${API_ROOT}/settings/integrations/totvs-integrator/portal/${idPortal}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${API_ROOT}/portal/login-settings/${idPortal}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${API_ROOT}/portal/domain/${idPortal}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${API_ROOT}/portal/totvs/${idPortal}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(`${API_ROOT}/pages`, { headers, validateStatus: () => true, timeout: 30_000 }),
      // Catálogo `field_id -> label` usado para resolver o "Campo do sistema" vinculado a cada
      // parâmetro de consulta (`/settings/totvs-query/list` só devolve o `field_id` cru) — mesmo
      // endpoint que `listSelectiveProcessStages` já usa em `actions/integrations/ps-docs.ts`.
      axios.post(`${API_ROOT}/selective-process/standard-fields`, null, { headers, validateStatus: () => true, timeout: 60_000 }),
    ]);

    if (generalRes.status >= 400) throw Object.assign(new Error(`HTTP ${generalRes.status} ao consultar portal/general`), { response: { status: generalRes.status } });

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
          const [popupRes, queryRes] = await Promise.all([
            axios.get(`${API_ROOT}/popups/${id}`, { headers, validateStatus: () => true, timeout: 30_000 }),
            axios.get(`${API_ROOT}/popups/querys/${id}`, { headers, validateStatus: () => true, timeout: 30_000 }),
          ]);
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
      fetchCampoResumo(general.register_field_id, headers, fieldCatalog, warnings, "Campo de código do registro"),
      fetchCampoResumo(general.course_field_id, headers, fieldCatalog, warnings, "Campo de oferta de curso"),
      fetchCampoResumo(general.local_offer_field_id, headers, fieldCatalog, warnings, "Campo de local de oferta"),
    ]);

    const geral: PortalGeralSpec = {
      nome: firstString(general, ["name"]) ?? `Portal ${idPortal}`,
      titulo: firstString(general, ["title"]) ?? "",
      ativo: general.status === 1,
      paginaEdicaoInscricao: resolvePagina(general.applyment_edit_page_id),
      paginaDetalhesUsuario: resolvePagina(general.user_details_page_id),
      carregamentoInteligente: general.disable_loaders === 0,
      vlibrasAtivo: general.enable_Vlibras === 1,
      cabecalhoAtivo: headerAtivo,
      cabecalhoTexto: headerAtivo ? firstString(general, ["header_message"]) : undefined,
      popupLgpd,
      linkLogoff: firstString(general, ["log_off_link"]),
      campoRegistro,
      campoOfertaCurso,
      campoLocalOferta,
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

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url: generalUrl,
      httpMethod: "GET",
      httpStatus: generalRes.status,
      requestSummary: { idPortal },
      responseSummary: { consultas: consultas.length, integracoes: integracoes.length },
    });

    return {
      success: true,
      overview: {
        idPortal,
        geral,
        consultas,
        scripts,
        integracoes,
        seguranca,
        dominio,
        totvs,
        warnings,
      },
    };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url: generalUrl, method: "GET", idPs: idPortal, error });
    return { success: false, error: (error as Error).message };
  }
}

export interface ListPortalProcessesResult {
  success: boolean;
  error?: string;
  processes?: PortalProcessRef[];
}

export async function listPortalSelectiveProcesses(input: { tokenPs: string; idPortal: string }): Promise<ListPortalProcessesResult> {
  const { organizationId, userId } = await requirePermission("ps_docs", "execute");

  const idPortal = input.idPortal.trim();
  const tokenPs = input.tokenPs.trim();
  if (!idPortal || !tokenPs) return { success: false, error: "Informe o Token PS e o ID do Portal" };

  const headers = authHeaders(tokenPs);
  const url = `${API_ROOT}/portal/selective-process-local/${idPortal}`;

  try {
    const res = await axios.get(url, { headers, validateStatus: () => true, timeout: 30_000 });
    if (res.status >= 400) throw Object.assign(new Error(`HTTP ${res.status} ao consultar selective-process-local`), { response: { status: res.status } });

    const all = asArray(unwrapData(res.data));
    const processes: PortalProcessRef[] = all
      .filter((p) => p.status === 1)
      .map((p) => ({ id: String(p.id), identifier: firstString(p, ["identifier"]) ?? String(p.id), name: firstString(p, ["name"]) ?? "(processo sem nome)" }));

    await logApiCall({ organizationId, userId, integration: "PS_DOCS", url, httpMethod: "GET", httpStatus: res.status, requestSummary: { idPortal }, responseSummary: { total: all.length, ativos: processes.length } });

    return { success: true, processes };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: idPortal, error });
    return { success: false, error: (error as Error).message };
  }
}
