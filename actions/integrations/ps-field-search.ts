"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { hasRequiredCredentials, type PsCredentials } from "@/lib/ps-docs/credential";
import { authHeaders, sessionErrorMessage, unwrapData, logApiCall, logAndNotifyFailure, type Raw } from "@/lib/ps-docs/api-helpers";
import { buildIdTitleCatalog, harvestFieldLabels, parsePage, parsePopup, EMPTY_CATALOGS, type ActionCatalogs } from "@/lib/ps-docs/parse-structure";
import { parseComponentDetail, type ComponentDetail } from "@/lib/ps-docs/component-detail";
import type { ActionCatalogEntries } from "@/actions/integrations/ps-docs";
import type { ItemSpec, PaginaSpec, PopupSpec } from "@/lib/ps-docs/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * "Busca de campos PS" — the pages/pop-ups part of the sweep. Etapas/passos/feedbacks and the
 * portal overview come from the same actions the "Documentação PS" screen uses
 * (`ps-docs.ts`/`ps-portal-docs.ts`); this file only adds what that pipeline doesn't fetch:
 *  - `GET /api/pages/{id}`  -> a page's own content (same `content[]` shape as a pop-up)
 *  - `GET /api/popups/{id}` -> pop-ups not reached from any etapa (portal mode sweeps the catalog)
 *  - `GET /api/pages` / `GET /api/popups` -> the `{id, name}` catalogs for that sweep
 *  - `GET /api/custom-component/{id}` -> one component's full config (button_actions with their
 *    actions/fields/parameters, totvs_query, forwardData), loaded when a result row is expanded
 */
const API_ROOT = "https://admin.portal.apprbs.com.br/api";
const CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function toActionCatalogs(entries?: ActionCatalogEntries): ActionCatalogs {
  if (!entries) return EMPTY_CATALOGS;
  return {
    actionTypes: new Map(entries.actionTypes),
    dataServerTypes: new Map(entries.dataServerTypes),
    processTypes: new Map(entries.processTypes),
    popups: new Map(entries.popups),
    pages: new Map(entries.pages),
    rubeusEvents: new Map(entries.rubeusEvents),
    personTypes: new Map(entries.personTypes),
  };
}

export interface ContainerCatalogResult {
  success: boolean;
  error?: string;
  popups?: [number, string][];
  pages?: [number, string][];
}

export async function listPsContainerCatalog(input: { credentials: PsCredentials }): Promise<ContainerCatalogResult> {
  const { organizationId, userId } = await requirePermission("ps_field_search", "execute");
  if (!hasRequiredCredentials(input.credentials)) return { success: false, error: "Informe os cookies da sessão" };

  const headers = authHeaders(input.credentials);
  const url = `${API_ROOT}/pages`;
  try {
    const [popupsRes, pagesRes] = await Promise.all([
      axios.get(`${API_ROOT}/popups`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(url, { headers, validateStatus: () => true, timeout: 30_000 }),
    ]);
    for (const res of [popupsRes, pagesRes]) {
      if (res.status === 401 || res.status === 419) throw Object.assign(new Error(`HTTP ${res.status}`), { response: { status: res.status } });
    }
    return {
      success: true,
      popups: popupsRes.status < 400 ? [...buildIdTitleCatalog(popupsRes.data).entries()] : [],
      pages: pagesRes.status < 400 ? [...buildIdTitleCatalog(pagesRes.data).entries()] : [],
    };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: "-", error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
  }
}

export interface FetchContainersResult {
  success: boolean;
  error?: string;
  popups?: [number, PopupSpec][];
  pages?: [number, PaginaSpec][];
  warnings?: string[];
}

/** Fetches and parses a batch of pop-ups and pages. Pop-ups opened from a page's own buttons are
 *  fetched too and attached as `popupDetalhe`, mirroring what `fetchStageDocumentation` does for
 *  an etapa. Best-effort per id: a failed one becomes a warning, not an error. */
export async function fetchPsContainers(input: {
  credentials: PsCredentials;
  popupIds: number[];
  pageIds: number[];
  fieldCatalogEntries?: [number, string][];
  actionCatalogEntries?: ActionCatalogEntries;
}): Promise<FetchContainersResult> {
  const { organizationId, userId } = await requirePermission("ps_field_search", "execute");
  if (!hasRequiredCredentials(input.credentials)) return { success: false, error: "Informe os cookies da sessão" };

  const headers = authHeaders(input.credentials);
  const baseCatalog = new Map(input.fieldCatalogEntries ?? []);
  const catalogs = toActionCatalogs(input.actionCatalogEntries);
  const warnings: string[] = [];
  let sessionExpired = false;

  // Same enrichment as `parseEtapa`: labels harvested from the payload itself fill the gaps of the
  // base catalog, never overwriting it.
  const catalogFor = (raw: unknown) => {
    const harvested = harvestFieldLabels(raw);
    return harvested.size > 0 ? new Map([...harvested, ...baseCatalog]) : baseCatalog;
  };

  const fetchOne = async (kind: "popups" | "pages", id: number): Promise<unknown | undefined> => {
    try {
      const res = await axios.get(`${API_ROOT}/${kind}/${id}`, { headers, validateStatus: () => true, timeout: 30_000 });
      if (res.status === 401 || res.status === 419) sessionExpired = true;
      if (res.status >= 400) {
        warnings.push(`${kind === "popups" ? "Pop-up" : "Página"} #${id}: HTTP ${res.status}`);
        return undefined;
      }
      return res.data;
    } catch (error) {
      warnings.push(`${kind === "popups" ? "Pop-up" : "Página"} #${id}: ${(error as Error).message}`);
      return undefined;
    }
  };

  const popupIds = [...new Set(input.popupIds)];
  const pageIds = [...new Set(input.pageIds)];

  const pageRaws = await mapWithConcurrency(pageIds, CONCURRENCY, async (id) => ({ id, raw: await fetchOne("pages", id) }));
  const pages: [number, PaginaSpec][] = [];
  for (const { id, raw } of pageRaws) {
    if (raw === undefined) continue;
    const spec = parsePage(raw, catalogFor(raw), catalogs);
    if (spec.itens.length === 0) warnings.push(`Página "${spec.nome}" (#${id}) não retornou componentes — formato da resposta não reconhecido ou página vazia.`);
    pages.push([id, spec]);
  }

  // Pop-ups opened from inside a page, fetched alongside the requested ones.
  const nestedEncs = pages.flatMap(([, page]) => {
    const found: { popupId?: number; popupDetalhe?: PopupSpec }[] = [];
    const visit = (itens: ItemSpec[]) => {
      for (const item of itens) {
        for (const enc of item.encaminhamentos ?? []) if (enc.popupId) found.push(enc);
        if (item.filhos) visit(item.filhos);
      }
    };
    visit(page.itens);
    return found;
  });
  const allPopupIds = [...new Set([...popupIds, ...nestedEncs.map((enc) => enc.popupId!)])];

  const popupRaws = await mapWithConcurrency(allPopupIds, CONCURRENCY, async (id) => ({ id, raw: await fetchOne("popups", id) }));
  const popupById = new Map<number, PopupSpec>();
  for (const { id, raw } of popupRaws) {
    if (raw !== undefined) popupById.set(id, parsePopup(raw, undefined, catalogFor(raw), catalogs));
  }
  for (const enc of nestedEncs) enc.popupDetalhe = popupById.get(enc.popupId!);

  await logApiCall({
    organizationId,
    userId,
    integration: "PS_DOCS",
    url: `${API_ROOT}/pages|popups/{id}`,
    httpMethod: "GET",
    httpStatus: sessionExpired ? 401 : 200,
    requestSummary: { pageIds, popupIds } as Prisma.InputJsonValue,
    responseSummary: { pages: pages.length, popups: popupById.size, warnings: warnings.length } as Prisma.InputJsonValue,
  });

  if (sessionExpired && pages.length === 0 && popupById.size === 0) {
    return { success: false, error: sessionErrorMessage({ response: { status: 401 } }) };
  }

  return {
    success: true,
    pages,
    popups: popupIds.filter((id) => popupById.has(id)).map((id) => [id, popupById.get(id)!]),
    warnings,
  };
}

export interface ComponentDetailResult {
  success: boolean;
  error?: string;
  detail?: ComponentDetail;
}

export async function fetchComponentDetail(input: {
  credentials: PsCredentials;
  componentId: number;
  fieldCatalogEntries?: [number, string][];
  actionCatalogEntries?: ActionCatalogEntries;
}): Promise<ComponentDetailResult> {
  const { organizationId, userId } = await requirePermission("ps_field_search", "execute");
  if (!hasRequiredCredentials(input.credentials)) return { success: false, error: "Informe os cookies da sessão" };
  const componentId = Number(input.componentId);
  if (!Number.isInteger(componentId) || componentId <= 0) return { success: false, error: "Componente inválido" };

  const url = `${API_ROOT}/custom-component/${componentId}`;
  const headers = { ...authHeaders(input.credentials), Referer: "https://admin.portal.apprbs.com.br/administrativo/definicoes" };
  try {
    const res = await axios.get(url, { headers, validateStatus: () => true, timeout: 30_000 });
    if (res.status >= 400) throw Object.assign(new Error(`HTTP ${res.status} ao consultar o componente #${componentId}`), { response: { status: res.status } });

    const raw = unwrapData(res.data);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Resposta inesperada ao consultar o componente #${componentId}`);

    const baseCatalog = new Map(input.fieldCatalogEntries ?? []);
    const harvested = harvestFieldLabels(raw);
    const fieldCatalog = harvested.size > 0 ? new Map([...harvested, ...baseCatalog]) : baseCatalog;
    const detail = parseComponentDetail(raw as Raw, fieldCatalog, toActionCatalogs(input.actionCatalogEntries));

    await logApiCall({
      organizationId,
      userId,
      integration: "PS_DOCS",
      url,
      httpMethod: "GET",
      httpStatus: res.status,
      requestSummary: { componentId } as Prisma.InputJsonValue,
      responseSummary: { buttonActions: detail.grupos.length } as Prisma.InputJsonValue,
    });
    return { success: true, detail };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "GET", idPs: "-", error });
    return { success: false, error: sessionErrorMessage(error) ?? (error as Error).message };
  }
}
