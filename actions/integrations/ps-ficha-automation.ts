"use server";

import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listSelectiveProcessStages, fetchStageDocumentation } from "@/actions/integrations/ps-docs";
import type { EtapaSpec, ItemSpec } from "@/lib/ps-docs/types";
import { buildTestPlan, flattenCampos, type PlannedCheck } from "@/lib/ps-ficha-automation/test-plan";
import {
  launchBrowser,
  openFichaPage,
  fillOneField,
  probeOneInvalidVariant,
  probeRequiredEmpty,
  waitForRevealAndScan,
  clickAvancarEEsperar,
  closeBrowser,
  type AdvanceResult,
  type RuleCheck,
  type RevealOutcome,
} from "@/lib/ps-ficha-automation/browser-engine";
import { createRun, getRun, deleteRun, type RunState } from "@/lib/ps-ficha-automation/run-registry";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Orquestra a automação de preenchimento REAL da ficha pública (navegador de verdade, não API).
 * Reaproveita `listSelectiveProcessStages`/`fetchStageDocumentation` (`actions/integrations/ps-docs.ts`)
 * só pra saber quais campos existem em cada passo — o plano de testes completo (`buildTestPlan`,
 * `lib/ps-ficha-automation/test-plan.ts`) é calculado ANTES de abrir o navegador, por explícita
 * instrução, pra mostrar tudo que vai ser testado antes de qualquer preenchimento real. Cada
 * checagem do plano roda numa chamada separada (`runAutomationCheck`), reaproveitando a MESMA
 * sessão de navegador entre chamadas via `lib/ps-ficha-automation/run-registry.ts` — dá progresso
 * granular na tela em vez de só quando o passo inteiro termina.
 */

export interface StartAutomationResult {
  success: boolean;
  error?: string;
  runId?: string;
  testPlan?: PlannedCheck[];
}

export async function startFichaAutomationRun(input: { tokenPs: string; idPs: string; pageUrl: string; crmDomain?: string }): Promise<StartAutomationResult> {
  const { organizationId, userId } = await requirePermission("ps_ficha_test", "execute");

  const tokenPs = input.tokenPs.trim();
  const idPs = input.idPs.trim();
  const pageUrl = input.pageUrl.trim();
  if (!tokenPs || !idPs || !pageUrl) return { success: false, error: "Informe o Token PS, o ID do Processo Seletivo e o link da página" };

  const listRes = await listSelectiveProcessStages({ tokenPs, idPs, crmDomain: input.crmDomain?.trim() || undefined });
  if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
    return { success: false, error: listRes.error || "Erro ao consultar o processo seletivo" };
  }

  const etapas: EtapaSpec[] = [];
  for (const stage of listRes.stages) {
    const stageRes = await fetchStageDocumentation({
      tokenPs,
      idPs,
      stage: stage.ref,
      fieldCatalogEntries: listRes.fieldCatalogEntries,
      actionCatalogEntries: listRes.actionCatalogEntries,
    });
    if (!stageRes.success || !stageRes.etapa) {
      return { success: false, error: `Etapa "${stage.label}": ${stageRes.error ?? "falha ao consultar a estrutura"}` };
    }
    etapas.push(stageRes.etapa);
  }
  if (etapas.length === 0) return { success: false, error: "Nenhuma etapa ativa encontrada para este processo seletivo" };

  const testPlan = buildTestPlan(etapas);

  let browser;
  try {
    browser = await launchBrowser();
    const { context, page } = await openFichaPage(browser, pageUrl);

    const run = await prisma.fichaAutomationRun.create({
      data: { organizationId, userId, idPs, pageUrl, status: "RUNNING" },
    });

    createRun(run.id, {
      dbRunId: run.id,
      browser,
      context,
      page,
      idPs,
      etapas,
      testPlan,
      stepBuffer: { fields: [], ruleChecks: [] },
      stepsCompleted: 0,
      finalSubmitDone: false,
      lastActivityAt: Date.now(),
    });

    return { success: true, runId: run.id, testPlan };
  } catch (error) {
    if (browser) await closeBrowser(browser);
    return { success: false, error: (error as Error).message };
  }
}

function findItem(etapas: EtapaSpec[], check: PlannedCheck): ItemSpec | undefined {
  if (check.fieldId === undefined) return undefined;
  const passo = etapas[check.etapaIndex]?.passos[check.passoIndex];
  if (!passo) return undefined;
  return flattenCampos(passo.itens).find((i) => i.fieldId === check.fieldId);
}

function isLastPassoOf(etapas: EtapaSpec[], check: PlannedCheck): boolean {
  return check.etapaIndex === etapas.length - 1 && check.passoIndex === etapas[check.etapaIndex].passos.length - 1;
}

/** Grava UM `FichaAutomationStep` com tudo que foi acumulado no buffer do passo em andamento, e
 *  reseta o buffer — o granular (uma checagem por chamada) só existe na tela em tempo real; o
 *  banco continua com um registro por passo, sem migration nova. */
async function flushPassoStep(state: RunState, check: PlannedCheck, advance: AdvanceResult) {
  const order = state.stepsCompleted;
  state.stepsCompleted += 1;
  await prisma.fichaAutomationStep.create({
    data: {
      runId: state.dbRunId,
      order,
      etapaNome: check.etapaNome,
      passoNome: check.passoNome,
      kind: "fill-advance",
      status: advance.advanced ? "SUCCESS" : "FAILED",
      fieldsFilled: state.stepBuffer.fields.filter((f) => f.status === "success").length,
      fieldsFailed: state.stepBuffer.fields.filter((f) => f.status === "failed").length,
      errorMessage: advance.advanced ? undefined : advance.validationErrors.join("; ") || "A ficha não avançou e não reportou um erro específico",
      details: { fields: state.stepBuffer.fields, ruleChecks: state.stepBuffer.ruleChecks, validationErrors: advance.validationErrors } as unknown as Prisma.InputJsonValue,
    },
  });
  state.stepBuffer = { fields: [], ruleChecks: [] };
}

export interface AutomationCheckResult {
  success: boolean;
  error?: string;
  checkId: string;
  fieldStatus?: "success" | "failed" | "skipped";
  fieldValue?: string;
  fieldReason?: string;
  ruleCheck?: RuleCheck;
  advance?: AdvanceResult;
  revealOutcome?: RevealOutcome;
  navigatedAway?: boolean;
  passoComplete?: boolean;
  isLastPasso?: boolean;
  runDone?: boolean;
  pendingConfirmation?: boolean;
}

/** Executa UMA checagem do plano de testes contra a sessão de navegador já aberta (`runId`) —
 *  uma chamada por checagem, pra dar progresso granular na tela ("mostrando, carregando para cada
 *  teste", por explícita instrução). Se a checagem for o "Avançar" do último passo da última
 *  etapa e `confirmFinalSubmit` não tiver sido marcado, não clica em nada — devolve
 *  `pendingConfirmation: true`; uma chamada seguinte com `confirmFinalSubmit: true` na MESMA
 *  checagem conclui de verdade. */
export async function runAutomationCheck(input: { runId: string; checkId: string; confirmFinalSubmit: boolean }): Promise<AutomationCheckResult> {
  await requirePermission("ps_ficha_test", "execute");

  const state = getRun(input.runId);
  if (!state) return { success: false, error: "Execução não encontrada ou expirada", checkId: input.checkId };

  const check = state.testPlan.find((c) => c.id === input.checkId);
  if (!check) return { success: false, error: "Checagem não encontrada no plano", checkId: input.checkId };

  const isLastPasso = isLastPassoOf(state.etapas, check);

  try {
    if (check.kind === "avancar") {
      if (isLastPasso && !input.confirmFinalSubmit) {
        return { success: true, checkId: check.id, pendingConfirmation: true, isLastPasso };
      }

      const advance = await clickAvancarEEsperar(state.page);
      await flushPassoStep(state, check, advance);

      if (!advance.advanced) {
        const errorMessage = advance.validationErrors.join("; ") || "A ficha não avançou e não reportou um erro específico";
        await prisma.fichaAutomationRun.update({ where: { id: state.dbRunId }, data: { status: "ERROR", errorMessage, finishedAt: new Date() } });
        return { success: false, checkId: check.id, error: errorMessage, advance };
      }

      if (isLastPasso) state.finalSubmitDone = true;
      return { success: true, checkId: check.id, advance, passoComplete: true, isLastPasso, runDone: isLastPasso };
    }

    if (check.kind === "revelar-condicionais") {
      const revealOutcome = await waitForRevealAndScan(state.page, check.revealTargets ?? []);
      return { success: true, checkId: check.id, revealOutcome };
    }

    const item = findItem(state.etapas, check);
    if (!item) return { success: false, checkId: check.id, error: "Campo não encontrado na estrutura da ficha" };

    if (check.kind === "preencher") {
      if (!check.fillStrategy) return { success: false, checkId: check.id, error: "Checagem sem estratégia de preenchimento" };
      const outcome = await fillOneField(state.page, item, check.fillStrategy);
      state.stepBuffer.fields.push({ fieldId: item.fieldId ?? -1, label: check.label, status: outcome.status, value: outcome.value, reason: outcome.reason });
      // `success` aqui só reflete se a CHAMADA rodou sem exceção — um campo que falhou ao
      // preencher é dado pro relatório (`fieldStatus`), não um motivo pra abortar a automação
      // inteira. Só a checagem "avancar" genuinamente bloqueada interrompe o loop no cliente.
      return { success: true, checkId: check.id, fieldStatus: outcome.status, fieldValue: outcome.value, fieldReason: outcome.reason };
    }

    if (check.kind === "formato-invalido") {
      if (!check.fillStrategy || !check.invalidInput) return { success: false, checkId: check.id, error: "Checagem sem dados de sondagem" };
      const ruleCheck = await probeOneInvalidVariant(state.page, item, check.fillStrategy, check.invalidInput);
      state.stepBuffer.ruleChecks.push(ruleCheck);
      return { success: true, checkId: check.id, ruleCheck };
    }

    if (check.kind === "campo-obrigatorio-vazio") {
      if (!check.fillStrategy) return { success: false, checkId: check.id, error: "Checagem sem estratégia de preenchimento" };
      const outcome = await probeRequiredEmpty(state.page, item, check.fillStrategy);
      state.stepBuffer.ruleChecks.push(outcome);

      if (outcome.navigatedAway) {
        await flushPassoStep(state, check, { advanced: true, validationErrors: [] });
        if (isLastPasso) state.finalSubmitDone = true;
        return { success: true, checkId: check.id, ruleCheck: outcome, navigatedAway: true, passoComplete: true, isLastPasso, runDone: isLastPasso };
      }
      return { success: true, checkId: check.id, ruleCheck: outcome };
    }

    return { success: false, checkId: check.id, error: "Tipo de checagem desconhecido" };
  } catch (error) {
    return { success: false, checkId: check.id, error: (error as Error).message };
  }
}

export interface FinalizeAutomationResult {
  success: boolean;
  status?: string;
}

/** Fecha o navegador e marca o status final da execução. `reason` distingue conclusão normal
 *  ("completed") de interrupção manual pelo botão "Parar" ("stopped") ou erro ("error"). Se sobrar
 *  algo no buffer do passo em andamento (parado no meio de um passo), grava mesmo assim como um
 *  `FichaAutomationStep` parcial, pra nada ficar só na tela e sumir do banco. Idempotente: se a
 *  sessão já não existir mais (erro anterior já limpou), só confirma o status já gravado. */
export async function finalizeFichaAutomationRun(input: { runId: string; reason: "completed" | "stopped" | "error" }): Promise<FinalizeAutomationResult> {
  await requirePermission("ps_ficha_test", "execute");

  const state = getRun(input.runId);
  if (!state) {
    const run = await prisma.fichaAutomationRun.findUnique({ where: { id: input.runId }, select: { status: true } });
    return { success: true, status: run?.status ?? "DONE" };
  }

  if (state.stepBuffer.fields.length > 0 || state.stepBuffer.ruleChecks.length > 0) {
    const order = state.stepsCompleted;
    state.stepsCompleted += 1;
    await prisma.fichaAutomationStep.create({
      data: {
        runId: state.dbRunId,
        order,
        etapaNome: "—",
        passoNome: "—",
        kind: "fill-advance",
        status: "FAILED",
        fieldsFilled: state.stepBuffer.fields.filter((f) => f.status === "success").length,
        fieldsFailed: state.stepBuffer.fields.filter((f) => f.status === "failed").length,
        errorMessage: input.reason === "stopped" ? "Interrompida manualmente pelo usuário antes de concluir o passo" : "Execução finalizada com o passo incompleto",
        details: { fields: state.stepBuffer.fields, ruleChecks: state.stepBuffer.ruleChecks } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  const status = input.reason === "stopped" ? "PARTIAL" : input.reason === "error" ? "ERROR" : "DONE";
  const errorMessage = input.reason === "stopped" ? "Interrompida manualmente pelo usuário" : undefined;
  await prisma.fichaAutomationRun.update({
    where: { id: state.dbRunId },
    data: { status, errorMessage, finalSubmitConfirmed: state.finalSubmitDone, finishedAt: new Date() },
  });
  await deleteRun(input.runId);
  return { success: true, status };
}
