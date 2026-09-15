import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { ItemSpec } from "@/lib/ps-docs/types";
import type { FichaFieldFillStrategy } from "./field-data-generator";

/**
 * Camada fina sobre o `playwright-core` que sabe preencher/avançar a ficha PÚBLICA de verdade
 * (não a API administrativa — essa página não exige Token PS/login). Confirmado ao vivo
 * (navegador) em `https://portal.apprbs.com.br/senai-exemplo?idPs=17869...`:
 *  - Todo campo tem `name="data[<field_id>]"`, o MESMO id já resolvido pela Documentação PS.
 *  - Campos de data (flatpickr) têm um input OCULTO com o `name`, e um input de TEXTO visível
 *    (sem `name`) por cima — é nele que o usuário de verdade digita, então é nele que a automação
 *    precisa digitar também.
 *  - O botão "Avançar" salva o passo atual e navega para `/passo/<novo-id>`.
 * Não cliquei em "Avançar" na etapa final durante a investigação (para não gerar uma inscrição
 * real sem autorização) — por isso a confirmação final é tratada pela camada de actions
 * (`actions/integrations/ps-ficha-automation.ts`) como o MESMO clique de "Avançar" do último
 * passo da última etapa, só que condicionado a `confirmFinalSubmit`, em vez de um botão separado.
 *
 * Cada função aqui executa UMA checagem por vez (`lib/ps-ficha-automation/test-plan.ts` decide o
 * QUE e a ORDEM; esta camada só sabe COMO interagir com o navegador) — dá pra chamar granularmente
 * a partir de uma Server Action por checagem, o que permite mostrar progresso item a item na tela.
 */

const NAV_TIMEOUT_MS = 20_000;
const NETWORK_IDLE_TIMEOUT_MS = 5_000;

/** Dentro do Docker (`development`/`production`) usa o Chromium do Alpine via
 *  `PLAYWRIGHT_CHROMIUM_PATH` (ver `Dockerfile`), sempre headless (sem tela lá). Rodando local
 *  (`npm run dev` direto, sem Docker) abre uma janela DE VERDADE, visível, por explícita
 *  instrução — Chrome se estiver instalado, Edge como reserva (ambos baseados em Chromium, o
 *  mesmo `chromium.launch` do Playwright dirige os dois). Sem nenhum dos dois instalados, erro
 *  claro em vez de tentar adivinhar — Firefox/Safari não são suportados por `chromium.launch`
 *  (exigiriam trocar toda a base de automação pra `playwright.firefox()`/`webkit()`, fora do
 *  escopo desse ajuste). */
export async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (executablePath) return chromium.launch({ executablePath, headless: true });

  for (const channel of ["chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ channel, headless: false });
    } catch {
      continue;
    }
  }
  throw new Error("Nenhum navegador Chrome ou Edge encontrado nesta máquina para rodar a automação. Instale o Google Chrome ou o Microsoft Edge.");
}

export async function openFichaPage(browser: Browser, url: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
  await waitNetworkIdle(page);
  // Confirmado ao vivo: a ficha pública passa por uma tela de carregamento/seleção antes de
  // navegar (via JS no cliente, sem tráfego de rede extra) pro primeiro passo de verdade
  // (`/passo/<id>`) — `networkidle` sozinho não garante que essa transição já aconteceu. Espera
  // pelo menos um campo do formulário aparecer no DOM antes de devolver o controle, senão as
  // primeiras checagens rodam contra a tela errada e todo campo aparenta estar "oculto".
  await page.waitForSelector('[class*="formio-component-"]', { timeout: NAV_TIMEOUT_MS }).catch(() => undefined);
  await waitNetworkIdle(page);
  return { context, page };
}

async function waitNetworkIdle(page: Page, timeout = NETWORK_IDLE_TIMEOUT_MS) {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => undefined);
}

/** Acha o controle de verdade a interagir pra um `fieldId` — prioriza um input/select/textarea
 *  visível e nomeado `data[<fieldId>]`; cai para o proxy de texto visível do flatpickr (sem
 *  `name` próprio) quando o único elemento nomeado está oculto (caso dos campos de data). */
async function locateFieldControl(page: Page, fieldId: number) {
  const wrapper = page.locator(`.formio-component-${fieldId}`).first();
  const named = wrapper.locator(`[name="data[${fieldId}]"]`);
  const count = await named.count();
  for (let i = 0; i < count; i++) {
    const el = named.nth(i);
    const type = await el.getAttribute("type");
    if (type !== "hidden" && (await el.isVisible().catch(() => false))) return el;
  }
  const visibleText = wrapper.locator('input[type="text"]:visible').first();
  if ((await visibleText.count()) > 0) return visibleText;
  return named.first();
}

/** Um campo está visível quando o wrapper existe no DOM e está realmente exibido — usado pra
 *  distinguir "oculto de verdade" (sem lógica associada) de "condicional que ainda não apareceu"
 *  (ver `lib/ps-ficha-automation/test-plan.ts`, nunca pular esse segundo caso). */
export async function isFieldVisible(page: Page, fieldId: number): Promise<boolean> {
  const wrapper = page.locator(`.formio-component-${fieldId}`).first();
  if ((await wrapper.count().catch(() => 0)) === 0) return false;
  return wrapper.isVisible().catch(() => false);
}

async function fillSelectLike(page: Page, fieldId: number, presetValue?: string): Promise<{ ok: boolean; value?: string; reason?: string }> {
  const wrapper = page.locator(`.formio-component-${fieldId}`).first();
  const select = wrapper.locator(`select[name="data[${fieldId}]"]`).first();
  if ((await select.count()) > 0) {
    if (presetValue) {
      await select.selectOption(presetValue).catch(() => undefined);
      return { ok: true, value: presetValue };
    }
    const options = await select.locator("option").all();
    for (const opt of options) {
      const value = await opt.getAttribute("value");
      if (value) {
        await select.selectOption(value);
        return { ok: true, value };
      }
    }
    return { ok: false, reason: "select sem opções válidas" };
  }

  const radios = wrapper.locator(`input[type="radio"][name="data[${fieldId}]"]`);
  const radioCount = await radios.count();
  if (radioCount > 0) {
    const target = presetValue ? wrapper.locator(`input[type="radio"][name="data[${fieldId}]"][value="${presetValue}"]`).first() : radios.first();
    await target.check({ force: true });
    return { ok: true, value: presetValue ?? (await target.getAttribute("value")) ?? undefined };
  }

  const groupBoxes = wrapper.locator(`input[type="checkbox"][name^="data[${fieldId}]["]`);
  const groupCount = await groupBoxes.count();
  if (groupCount > 0) {
    await groupBoxes.first().check({ force: true });
    return { ok: true, value: (await groupBoxes.first().getAttribute("name")) ?? undefined };
  }

  return { ok: false, reason: "controle de seleção não encontrado no DOM" };
}

export interface FieldCheckOutcome {
  status: "success" | "failed" | "skipped";
  value?: string;
  reason?: string;
}

/** Preenche UM campo com a estratégia dada. Antes de tentar, checa visibilidade ao vivo: campo
 *  sem lógica de exibição e invisível = oculto "de verdade" (skip); campo COM lógica associada
 *  mas ainda invisível = achado (failed), nunca skip silencioso — por explícita instrução. */
export async function fillOneField(page: Page, item: ItemSpec, strategy: FichaFieldFillStrategy): Promise<FieldCheckOutcome> {
  if (!item.fieldId) return { status: "failed", reason: "sem field_id resolvido" };
  if (strategy.kind === "skip") return { status: "skipped", reason: strategy.reason };

  const visible = await isFieldVisible(page, item.fieldId);
  if (!visible) {
    if (item.logica) return { status: "failed", reason: "campo tem lógica de exibição configurada, mas não apareceu no DOM (gatilho pode não ter revelado corretamente)" };
    return { status: "skipped", reason: "campo oculto (sem lógica associada — não controlado por nenhum gatilho conhecido)" };
  }

  try {
    if (strategy.kind === "text") {
      const control = await locateFieldControl(page, item.fieldId);
      await control.fill(strategy.value, { timeout: 5_000 });
      if (item.categoria === "cep") await waitNetworkIdle(page);
      return { status: "success", value: strategy.value };
    }
    if (strategy.kind === "checkbox") {
      const control = await locateFieldControl(page, item.fieldId);
      if (strategy.checked) await control.check({ force: true });
      else await control.uncheck({ force: true });
      return { status: "success", value: String(strategy.checked) };
    }
    if (strategy.kind === "select") {
      const outcome = await fillSelectLike(page, item.fieldId, strategy.value);
      return outcome.ok ? { status: "success", value: outcome.value } : { status: "failed", reason: outcome.reason };
    }
    return { status: "skipped", reason: "estratégia desconhecida" };
  } catch (error) {
    return { status: "failed", reason: (error as Error).message };
  }
}

export interface AdvanceResult {
  advanced: boolean;
  validationErrors: string[];
}

const INLINE_ERROR_SELECTOR = ".formio-errors .form-text, .formio-component.has-error .help-block, .is-invalid ~ .invalid-feedback, .alert-danger";

/** Clica em "Avançar" e espera OU a URL mudar (passo seguinte carregado) OU erros de validação
 *  inline aparecerem — o que vier primeiro, com timeout. */
export async function clickAvancarEEsperar(page: Page): Promise<AdvanceResult> {
  const button = page.getByRole("button", { name: "Avançar" }).first();
  const urlBefore = page.url();
  await button.click();

  try {
    await page.waitForURL((url) => url.toString() !== urlBefore, { timeout: NAV_TIMEOUT_MS });
    await waitNetworkIdle(page);
    return { advanced: true, validationErrors: [] };
  } catch {
    const errors = await page.locator(INLINE_ERROR_SELECTOR).allTextContents().catch(() => [] as string[]);
    return { advanced: false, validationErrors: errors.map((e) => e.trim()).filter(Boolean) };
  }
}

/** Checa se a ficha marcou o campo como inválido — texto de erro dentro do wrapper do campo (via
 *  `INLINE_ERROR_SELECTOR`) OU o próprio wrapper ganhando uma classe de erro conhecida do Form.io
 *  (`has-error`/`is-invalid`/`formio-error`), quando não há texto capturável. Seletor de erro ainda
 *  não confirmado ao vivo contra um valor de verdade inválido (ver comentário no topo do arquivo)
 *  — é o melhor palpite a partir do que se sabe do Form.io, ajustar após a primeira execução real. */
async function fieldErrorText(page: Page, fieldId: number): Promise<string | null> {
  const wrapper = page.locator(`.formio-component-${fieldId}`).first();
  const wrapperClass = (await wrapper.getAttribute("class").catch(() => null)) ?? "";
  const hasErrorClass = /has-error|is-invalid|formio-error/.test(wrapperClass);

  const errorLocator = wrapper.locator(`${INLINE_ERROR_SELECTOR}, .help-block, .error`);
  const count = await errorLocator.count().catch(() => 0);
  if (count > 0) {
    const text = await errorLocator.first().textContent().catch(() => null);
    if (text?.trim()) return text.trim();
  }
  return hasErrorClass ? "Campo marcado com erro pela ficha (sem mensagem de texto capturada)" : null;
}

export interface RuleCheck {
  fieldId: number;
  label: string;
  kind: "formato-invalido" | "campo-obrigatorio-vazio";
  input: string;
  expected: "bloqueado" | "aceito";
  actual: "bloqueado" | "aceito";
  passed: boolean;
  detail?: string;
}

/** Sonda UMA variação de formato inválido num campo (digita, tira o foco, checa erro) e restaura
 *  o valor válido antes de devolver — uma checagem isolada do plano de testes. */
export async function probeOneInvalidVariant(page: Page, item: ItemSpec, validStrategy: FichaFieldFillStrategy, invalidValue: string): Promise<RuleCheck> {
  const label = item.detalhes?.basico.rotulo ?? item.nome;
  if (!item.fieldId) return { fieldId: -1, label, kind: "formato-invalido", input: invalidValue, expected: "bloqueado", actual: "aceito", passed: false, detail: "sem field_id resolvido" };

  try {
    const control = await locateFieldControl(page, item.fieldId);
    await control.fill(invalidValue);
    await control.press("Tab").catch(() => undefined);
    await page.waitForTimeout(500);
    const errorText = await fieldErrorText(page, item.fieldId);
    const blocked = !!errorText;

    if (validStrategy.kind === "text") {
      await control.fill(validStrategy.value).catch(() => undefined);
      await control.press("Tab").catch(() => undefined);
    }

    return { fieldId: item.fieldId, label, kind: "formato-invalido", input: invalidValue, expected: "bloqueado", actual: blocked ? "bloqueado" : "aceito", passed: blocked, detail: errorText ?? undefined };
  } catch (error) {
    return { fieldId: item.fieldId, label, kind: "formato-invalido", input: invalidValue, expected: "bloqueado", actual: "aceito", passed: false, detail: (error as Error).message };
  }
}

export interface RequiredEmptyOutcome extends RuleCheck {
  /** `true` quando a ficha avançou de passo mesmo com o campo vazio — achado crítico; quem chama
   *  precisa tratar isso como um avanço real (não tenta "voltar"). */
  navigatedAway: boolean;
}

/** Sonda campo obrigatório vazio: limpa só esse campo, tenta "Avançar", espera bloqueio. Se a
 *  ficha deixar passar mesmo assim, é um achado crítico — devolve `navigatedAway: true` em vez de
 *  tentar desfazer a navegação. */
export async function probeRequiredEmpty(page: Page, item: ItemSpec, validStrategy: FichaFieldFillStrategy): Promise<RequiredEmptyOutcome> {
  const label = item.detalhes?.basico.rotulo ?? item.nome;
  if (!item.fieldId || validStrategy.kind !== "text") {
    return { fieldId: item.fieldId ?? -1, label, kind: "campo-obrigatorio-vazio", input: "(vazio)", expected: "bloqueado", actual: "aceito", passed: false, detail: "não aplicável a esse tipo de campo", navigatedAway: false };
  }

  try {
    const control = await locateFieldControl(page, item.fieldId);
    await control.fill("");
    const advance = await clickAvancarEEsperar(page);

    if (advance.advanced) {
      return {
        fieldId: item.fieldId,
        label,
        kind: "campo-obrigatorio-vazio",
        input: "(vazio)",
        expected: "bloqueado",
        actual: "aceito",
        passed: false,
        detail: "A ficha avançou de passo mesmo com este campo obrigatório vazio",
        navigatedAway: true,
      };
    }

    const restore = await locateFieldControl(page, item.fieldId);
    await restore.fill(validStrategy.value);
    return {
      fieldId: item.fieldId,
      label,
      kind: "campo-obrigatorio-vazio",
      input: "(vazio)",
      expected: "bloqueado",
      actual: "bloqueado",
      passed: true,
      detail: advance.validationErrors.join("; ") || undefined,
      navigatedAway: false,
    };
  } catch (error) {
    return { fieldId: item.fieldId, label, kind: "campo-obrigatorio-vazio", input: "(vazio)", expected: "bloqueado", actual: "aceito", passed: false, detail: (error as Error).message, navigatedAway: false };
  }
}

export interface RevealOutcome {
  revealed: number[];
  stillHidden: number[];
}

/** Espera a lógica de exibição do Form.io reagir (síncrona no cliente, só precisa de uma pausa
 *  curta) depois de preencher os campos-gatilho de um passo, e reconfirma quais dos campos
 *  dependentes realmente apareceram. */
export async function waitForRevealAndScan(page: Page, targetFieldIds: number[]): Promise<RevealOutcome> {
  await page.waitForTimeout(400);
  const revealed: number[] = [];
  const stillHidden: number[] = [];
  for (const fieldId of targetFieldIds) {
    if (await isFieldVisible(page, fieldId)) revealed.push(fieldId);
    else stillHidden.push(fieldId);
  }
  return { revealed, stillHidden };
}

export async function closeBrowser(browser: Browser) {
  await browser.close().catch(() => undefined);
}
