import type { EtapaSpec, ItemSpec } from "@/lib/ps-docs/types";
import { planFieldFill, invalidVariantsFor, type FichaFieldFillStrategy } from "./field-data-generator";

/**
 * Analisa a estrutura já lida da API (sem tocar no navegador) e monta a lista COMPLETA de
 * checagens que a automação vai executar, uma por uma, antes de preencher qualquer campo de
 * verdade — por explícita instrução, pra mostrar o plano inteiro na tela antes de começar.
 *
 * Também resolve campos condicionais: um campo com `logica` (`acao: "Mostrar"`) só existe na
 * ficha quando outro campo (o "gatilho") tem um valor específico — por explícita instrução, esses
 * campos NUNCA são pulados. O plano preenche os gatilhos primeiro, com o valor que efetivamente
 * revela os dependentes (não o valor padrão por obrigatoriedade), e só depois processa o resto —
 * que a essa altura já inclui os campos recém-revelados. Cobre o caso comum (uma condição, ação
 * "Mostrar", regra de igualdade); lógica combinada (múltiplas regras E/OU) usa a primeira regra
 * como valor-alvo — heurística, não um motor de regras genérico.
 */

export type CheckKind = "preencher" | "formato-invalido" | "campo-obrigatorio-vazio" | "revelar-condicionais" | "avancar";

export interface PlannedCheck {
  id: string;
  etapaIndex: number;
  passoIndex: number;
  etapaNome: string;
  passoNome: string;
  fieldId?: number;
  label: string;
  kind: CheckKind;
  /** Estratégia de preenchimento a usar — sempre presente pra "preencher"/"formato-invalido"/
   *  "campo-obrigatorio-vazio" (é o valor final válido, usado também pra restaurar depois de uma
   *  sondagem). Normalmente é só o que `planFieldFill` já decidiria sozinho; só é diferente
   *  (override) quando o campo é um gatilho condicional — aí carrega o valor que revela os
   *  dependentes, em vez do valor padrão. */
  fillStrategy?: FichaFieldFillStrategy;
  invalidInput?: string;
  /** `true` quando o próprio campo tem lógica de exibição — usado na execução pra decidir se um
   *  campo invisível no DOM é um achado (deveria estar visível) ou um oculto "de verdade". */
  hasConditionalLogic?: boolean;
  /** Só em "revelar-condicionais": os fieldIds que devem aparecer depois dos gatilhos deste passo. */
  revealTargets?: number[];
}

/** Achata agrupamentos num array plano de campos — mesma função usada em toda a automação
 *  (plano e execução), centralizada aqui pra nunca divergir. */
export function flattenCampos(itens: ItemSpec[]): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const item of itens) {
    if (item.categoria === "agrupamento" && item.filhos) out.push(...flattenCampos(item.filhos));
    else out.push(item);
  }
  return out;
}

function extractFieldId(campoRef: string): number | null {
  const match = campoRef.match(/\((\d+)\)\s*$/);
  return match ? Number(match[1]) : null;
}

interface RevealTarget {
  fieldId: number;
  revealValue: string;
}

/** Varre os campos de um passo e monta `campo-gatilho -> [{campo revelado, valor que revela}]`,
 *  a partir de `ItemSpec.logica` (só ação "Mostrar", só a primeira regra — ver limitação no
 *  comentário do topo do arquivo). */
function buildRevealMap(itens: ItemSpec[]): Map<number, RevealTarget[]> {
  const map = new Map<number, RevealTarget[]>();
  for (const item of flattenCampos(itens)) {
    if (!item.fieldId || !item.logica || item.logica.acao !== "Mostrar") continue;
    const rule = item.logica.regras?.[0];
    if (!rule?.campo || rule.valor === undefined) continue;
    const triggerId = extractFieldId(rule.campo);
    if (!triggerId) continue;
    const list = map.get(triggerId) ?? [];
    list.push({ fieldId: item.fieldId, revealValue: rule.valor });
    map.set(triggerId, list);
  }
  return map;
}

function applyRevealOverride(plan: FichaFieldFillStrategy, revealValue: string): FichaFieldFillStrategy {
  if (plan.kind === "checkbox") return { kind: "checkbox", checked: /^(true|sim|1)$/i.test(revealValue) };
  if (plan.kind === "text") return { kind: "text", value: revealValue };
  if (plan.kind === "select") return { kind: "select", value: revealValue, useLiveOptions: false };
  return plan;
}

export function buildTestPlan(etapas: EtapaSpec[]): PlannedCheck[] {
  const plan: PlannedCheck[] = [];
  let counter = 0;
  const nextId = () => `check-${counter++}`;

  etapas.forEach((etapa, etapaIndex) => {
    etapa.passos.forEach((passo, passoIndex) => {
      const campos = flattenCampos(passo.itens).filter((i) => i.categoria === "campo" || i.categoria === "cep");
      const revealMap = buildRevealMap(passo.itens);
      const triggerFieldIds = new Set(campos.filter((i) => i.fieldId && revealMap.has(i.fieldId)).map((i) => i.fieldId!));
      const triggers = campos.filter((i) => i.fieldId && triggerFieldIds.has(i.fieldId));
      const others = campos.filter((i) => !i.fieldId || !triggerFieldIds.has(i.fieldId));

      const pushChecksForField = (item: ItemSpec, override?: FichaFieldFillStrategy) => {
        if (!item.fieldId) return;
        const label = item.detalhes?.basico.rotulo ?? item.nome;
        const basePlan = planFieldFill(item);
        if (basePlan.kind === "skip") return; // desabilitado/somente leitura/oculto estático - nunca vira checagem
        const strategy = override ?? basePlan;
        const hasConditionalLogic = !!item.logica;

        plan.push({
          id: nextId(),
          etapaIndex,
          passoIndex,
          etapaNome: etapa.nome,
          passoNome: passo.nome,
          fieldId: item.fieldId,
          label,
          kind: "preencher",
          fillStrategy: strategy,
          hasConditionalLogic,
        });

        if (strategy.kind === "text") {
          const variants = invalidVariantsFor(item);
          if (variants) {
            for (const invalid of variants) {
              plan.push({
                id: nextId(),
                etapaIndex,
                passoIndex,
                etapaNome: etapa.nome,
                passoNome: passo.nome,
                fieldId: item.fieldId,
                label,
                kind: "formato-invalido",
                fillStrategy: strategy,
                invalidInput: invalid,
                hasConditionalLogic,
              });
            }
          }
          if (item.obrigatorio) {
            plan.push({
              id: nextId(),
              etapaIndex,
              passoIndex,
              etapaNome: etapa.nome,
              passoNome: passo.nome,
              fieldId: item.fieldId,
              label,
              kind: "campo-obrigatorio-vazio",
              fillStrategy: strategy,
              hasConditionalLogic,
            });
          }
        }
      };

      for (const item of triggers) {
        const targets = revealMap.get(item.fieldId!) ?? [];
        const revealValue = targets[0]?.revealValue;
        const basePlan = planFieldFill(item);
        const override = revealValue !== undefined && basePlan.kind !== "skip" ? applyRevealOverride(basePlan, revealValue) : undefined;
        pushChecksForField(item, override);
      }

      if (triggers.length > 0) {
        const revealTargets = triggers.flatMap((t) => (t.fieldId ? (revealMap.get(t.fieldId) ?? []).map((r) => r.fieldId) : []));
        plan.push({
          id: nextId(),
          etapaIndex,
          passoIndex,
          etapaNome: etapa.nome,
          passoNome: passo.nome,
          label: "Revelar campos condicionais",
          kind: "revelar-condicionais",
          revealTargets,
        });
      }

      for (const item of others) pushChecksForField(item);

      plan.push({ id: nextId(), etapaIndex, passoIndex, etapaNome: etapa.nome, passoNome: passo.nome, label: "Avançar", kind: "avancar" });
    });
  });

  return plan;
}
