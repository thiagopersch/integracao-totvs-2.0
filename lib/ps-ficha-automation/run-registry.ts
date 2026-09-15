import type { Browser, BrowserContext, Page } from "playwright-core";
import type { EtapaSpec } from "@/lib/ps-docs/types";
import type { PlannedCheck } from "./test-plan";
import { closeBrowser, type RuleCheck } from "./browser-engine";

export interface FieldFillResult {
  fieldId: number;
  label: string;
  status: "success" | "failed" | "skipped";
  value?: string;
  reason?: string;
}

/**
 * Guarda a sessão de navegador VIVA de uma execução (`runId`) entre chamadas de Server Action —
 * a automação roda uma checagem por chamada (`runAutomationCheck`), e uma Server Action é uma
 * requisição HTTP nova a cada vez, então a única forma de reaproveitar a MESMA página do
 * navegador é manter isso em memória no processo do servidor (aceitável aqui: app roda num único
 * container Docker, não serverless, não multi-instância — mesma suposição que já vale pro resto
 * do app). Limpa sozinho execuções abandonadas (aba fechada pelo usuário no meio, erro não
 * tratado, ou simplesmente esquecida pausada) via um timeout de inatividade, pra nunca vazar
 * processos de Chromium.
 */

export interface RunState {
  dbRunId: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  idPs: string;
  etapas: EtapaSpec[];
  testPlan: PlannedCheck[];
  /** Resultados acumulados do passo em andamento — só viram UMA linha em `FichaAutomationStep`
   *  quando a checagem "avancar" daquele passo roda (ou quando uma sondagem de obrigatoriedade
   *  avança sozinha). O granular fica só na tela em tempo real; o banco continua leve, por passo. */
  stepBuffer: { fields: FieldFillResult[]; ruleChecks: RuleCheck[] };
  /** Usado como `order` de cada `FichaAutomationStep` gravado. */
  stepsCompleted: number;
  finalSubmitDone: boolean;
  lastActivityAt: number;
}

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const registry = new Map<string, RunState>();

function sweep() {
  const now = Date.now();
  for (const [runId, state] of registry) {
    if (now - state.lastActivityAt > IDLE_TIMEOUT_MS) {
      closeBrowser(state.browser);
      registry.delete(runId);
    }
  }
}

// `globalThis` guard: em dev, o Next.js recarrega módulos a cada mudança — sem isso, cada reload
// criaria um novo `setInterval` órfão além do antigo, um por hot-reload.
const globalForRegistry = globalThis as unknown as { __fichaAutomationSweepStarted?: boolean };
if (!globalForRegistry.__fichaAutomationSweepStarted) {
  setInterval(sweep, SWEEP_INTERVAL_MS).unref();
  globalForRegistry.__fichaAutomationSweepStarted = true;
}

export function createRun(runId: string, state: RunState) {
  registry.set(runId, state);
}

export function getRun(runId: string): RunState | undefined {
  const state = registry.get(runId);
  if (state) state.lastActivityAt = Date.now();
  return state;
}

export async function deleteRun(runId: string) {
  const state = registry.get(runId);
  if (!state) return;
  await closeBrowser(state.browser);
  registry.delete(runId);
}
