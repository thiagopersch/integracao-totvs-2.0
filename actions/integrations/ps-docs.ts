"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import { buildFieldCatalog, parseEtapa, extractTituloPortal, type StageRef } from "@/lib/ps-docs/parse-structure";
import type { EtapaSpec } from "@/lib/ps-docs/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Rubeus "processo seletivo" builder API. Contract confirmed live (idPs 5537 and 17869) against
 * the requests the admin SPA itself makes when opening
 * `admin.portal.apprbs.com.br/administrativo/processo-seletivo/etapa/{idPs}-{idEtapa}`:
 *  - `GET  /opening-page-process/{idPs}`                            -> process title/settings
 *  - `GET  /opening-page-stages/{idPs}`                             -> list of ALL stages ("etapas")
 *    for the process (note: the `{idPs}-{idEtapa}` suffixed variant returns the exact same list —
 *    it does NOT scope to one stage, despite what the URL implies)
 *  - `POST /standard-fields` (no body)                              -> global `field_id -> label`
 *    catalog, fetched once for the whole process
 *  - `POST /selected-stage/{idPs}` body `{ stage_id, editor: true }` -> that stage's steps, each
 *    with the real field/component `content` array (a button's `button_actions`/`forwardData`
 *    live inline on its content item here)
 *  - `POST /feedback` body `{ stage_id, editor: true }` (no idPs in the URL) -> that stage's feedbacks
 *
 * Split into `listSelectiveProcessStages` + `fetchStageDocumentation` (one call per stage) rather
 * than a single monolithic action, so the page can render each etapa as soon as it arrives instead
 * of waiting for the whole process.
 */
const BASE_URL = "https://admin.portal.apprbs.com.br/api/selective-process";

function authHeaders(tokenPs: string) {
  return { Authorization: `Bearer ${tokenPs}`, "Content-Type": "application/json" };
}

type Raw = Record<string, unknown>;

function unwrapData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const obj = payload as Raw;
  return "data" in obj ? obj.data : obj;
}

function asArray(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((v): v is Raw => !!v && typeof v === "object");
  return [];
}

async function logAndNotifyFailure(params: { organizationId: string; userId: string; url: string; method: string; idPs: string; error: unknown }) {
  const errorMessage = (params.error as Error).message;
  await prisma.apiLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      integration: "PS_DOCS",
      url: params.url,
      httpMethod: params.method,
      error: errorMessage,
      requestSummary: { idPs: params.idPs } as Prisma.InputJsonValue,
    },
  });
  const notification = buildIntegrationTestFailedNotification({ integration: "PS_DOCS", errorMessage, errorKind: classifyError(params.error), url: params.url });
  await notificationService.create({ organizationId: params.organizationId, userId: params.userId, ...notification });
}

export interface StageListItem {
  ref: StageRef;
  label: string;
}

export interface ListStagesResult {
  success: boolean;
  error?: string;
  idPs?: string;
  tituloPortal?: string;
  stages?: StageListItem[];
  fieldCatalogEntries?: [number, string][];
}

/** Step 1: resolves the process title, the list of ACTIVE stages, and the global field catalog
 *  (needed to resolve `field_compare_id`/`field_id_to_save_*` references later). */
export async function listSelectiveProcessStages(input: { tokenPs: string; idPs: string }): Promise<ListStagesResult> {
  const { organizationId, userId } = await requirePermission("ps_docs", "execute");

  const idPs = input.idPs.trim();
  const tokenPs = input.tokenPs.trim();
  if (!idPs || !tokenPs) return { success: false, error: "Informe o Token PS e o ID PS" };

  const headers = authHeaders(tokenPs);
  const stageListUrl = `${BASE_URL}/opening-page-stages/${idPs}`;

  try {
    const [processRes, stageListRes, standardFieldsRes] = await Promise.all([
      axios.get(`${BASE_URL}/opening-page-process/${idPs}`, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.get(stageListUrl, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.post(`${BASE_URL}/standard-fields`, null, { headers, validateStatus: () => true, timeout: 60_000 }),
    ]);

    if (processRes.status >= 400) throw Object.assign(new Error(`HTTP ${processRes.status} ao consultar opening-page-process`), { response: { status: processRes.status } });
    if (stageListRes.status >= 400) throw Object.assign(new Error(`HTTP ${stageListRes.status} ao consultar opening-page-stages`), { response: { status: stageListRes.status } });
    if (standardFieldsRes.status >= 400) throw Object.assign(new Error(`HTTP ${standardFieldsRes.status} ao consultar standard-fields`), { response: { status: standardFieldsRes.status } });

    const allStages = asArray(unwrapData(stageListRes.data));
    const activeStages = allStages.filter((s) => s.status === 1);

    const stages: StageListItem[] = activeStages.map((s) => ({
      ref: {
        list: s,
        name: (s.title as string) ?? "(etapa sem nome)",
        ativa: true,
        steps: asArray(s.steps).map((st) => ({ id: Number(st.id), name: (st.name as string) ?? "" })),
        logics: s.logics,
      },
      label: (s.title as string) ?? "(etapa sem nome)",
    }));

    const fieldCatalog = buildFieldCatalog(standardFieldsRes.data);

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: "PS_DOCS",
        url: stageListUrl,
        httpMethod: "GET",
        httpStatus: stageListRes.status,
        requestSummary: { idPs } as Prisma.InputJsonValue,
        responseSummary: { etapasAtivas: stages.length, etapasTotal: allStages.length } as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      idPs,
      tituloPortal: extractTituloPortal(processRes.data, idPs),
      stages,
      fieldCatalogEntries: [...fieldCatalog.entries()],
    };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url: stageListUrl, method: "GET", idPs, error });
    return { success: false, error: (error as Error).message };
  }
}

export interface FetchStageResult {
  success: boolean;
  error?: string;
  etapa?: EtapaSpec;
  warnings?: string[];
}

/** Step 2: fetches and parses ONE stage — called once per active stage returned by
 *  `listSelectiveProcessStages`, so the page can append each etapa to the documentation as soon
 *  as it's ready. */
export async function fetchStageDocumentation(input: { tokenPs: string; idPs: string; stage: StageRef; fieldCatalogEntries: [number, string][] }): Promise<FetchStageResult> {
  const { organizationId, userId } = await requirePermission("ps_docs", "execute");

  const idPs = input.idPs.trim();
  const tokenPs = input.tokenPs.trim();
  const stageId = String(input.stage.list.id);
  const headers = authHeaders(tokenPs);
  const url = `${BASE_URL}/selected-stage/${idPs}`;

  try {
    const [selectedStageRes, feedbackRes] = await Promise.all([
      axios.post(url, { stage_id: stageId, editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }),
      axios.post(`${BASE_URL}/feedback`, { stage_id: stageId, editor: true }, { headers, validateStatus: () => true, timeout: 30_000 }),
    ]);

    if (selectedStageRes.status >= 400) throw Object.assign(new Error(`HTTP ${selectedStageRes.status} ao consultar selected-stage`), { response: { status: selectedStageRes.status } });

    const fieldCatalog = new Map(input.fieldCatalogEntries);
    const { etapa, warnings } = parseEtapa(
      input.stage,
      { list: input.stage.list, selectedStage: selectedStageRes.data, feedback: feedbackRes.status < 400 ? feedbackRes.data : undefined },
      fieldCatalog
    );

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: "PS_DOCS",
        url,
        httpMethod: "POST",
        httpStatus: selectedStageRes.status,
        requestSummary: { idPs, stageId } as Prisma.InputJsonValue,
        responseSummary: { passos: etapa.passos.length, warnings } as Prisma.InputJsonValue,
      },
    });

    return { success: true, etapa, warnings };
  } catch (error) {
    await logAndNotifyFailure({ organizationId, userId, url, method: "POST", idPs, error });
    return { success: false, error: (error as Error).message };
  }
}
