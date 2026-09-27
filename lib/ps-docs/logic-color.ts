import type { StyleConfig } from "./types";

const POSITIVE = new Set(["sim", "ativado", "ativada", "ativo", "ativa", "habilitado", "habilitada"]);
const NEGATIVE = new Set(["não", "nao", "desativado", "desativada", "inativo", "inativa", "desabilitado", "desabilitada"]);

export type LogicTone = "positive" | "negative";

/** Classifies a logical value ("Sim", "Ativado", "Não", "Desativado"…) — undefined for anything else. */
export function logicTone(value: string): LogicTone | undefined {
  const v = value.trim().toLowerCase();
  if (POSITIVE.has(v)) return "positive";
  if (NEGATIVE.has(v)) return "negative";
  return undefined;
}

/** Color (`#rrggbb`) configured in the style for a logical value, or undefined when not logical. */
export function logicColor(value: string, style: Pick<StyleConfig, "positiveColor" | "negativeColor">): string | undefined {
  const tone = logicTone(value);
  if (!tone) return undefined;
  return tone === "positive" ? style.positiveColor : style.negativeColor;
}
