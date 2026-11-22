import type { ItemSpec } from "./types";

/** "Agrupamento de campos ocultos" detection — an agrupamento whose fields the candidate never
 *  sees. Any one of three signals is enough (per explicit instruction):
 *  1. its name/label contains "oculto(s)";
 *  2. it is hidden in the builder itself (`form_build.hidden`, a `d-none`/`hidden` class or
 *     `display: none` in its own CSS);
 *  3. every child campo has "Esconder" on (an empty agrupamento never counts). */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function hiddenInBuilder(item: ItemSpec, rawHidden: boolean): boolean {
  if (rawHidden || item.escondido) return true;
  const classes = (item.classeCss ?? "").split(/\s+/);
  if (classes.includes("d-none") || classes.includes("hidden")) return true;
  return /display\s*:\s*none/i.test(item.cssCodigo ?? "");
}

function everyChildHidden(item: ItemSpec): boolean {
  const campos: ItemSpec[] = [];
  const walk = (items: ItemSpec[]) => {
    for (const c of items) {
      if (c.categoria === "agrupamento") walk(c.filhos ?? []);
      else if (c.categoria === "campo" || c.categoria === "cep") campos.push(c);
    }
  };
  walk(item.filhos ?? []);
  return campos.length > 0 && campos.every((c) => c.detalhes?.basico.esconder === true);
}

/** The reason the agrupamento counts as hidden, or undefined when it doesn't. */
export function detectHiddenGroup(item: ItemSpec, rawHidden = false): string | undefined {
  if (item.categoria !== "agrupamento") return undefined;
  if (/\boculto/.test(norm(item.nome))) return "nome contém “oculto”";
  if (hiddenInBuilder(item, rawHidden)) return "agrupamento escondido no construtor";
  if (everyChildHidden(item)) return "todos os campos com “Esconder” ativo";
  return undefined;
}

/** Uses the flag stored at parse time; models built before it existed fall back to detection. */
export function hiddenGroupReason(item: ItemSpec): string | undefined {
  if (item.categoria !== "agrupamento") return undefined;
  if (item.agrupamentoOculto === false) return undefined;
  if (item.agrupamentoOculto === true) return item.motivoOculto ?? "agrupamento de campos ocultos";
  return detectHiddenGroup(item);
}

export const HIDDEN_GROUP_SUFFIX = "campos ocultos";
export const HIDDEN_GROUP_HINT = "não exibidos ao candidato";

/** Block title for the RB-33 model — the "campos ocultos" suffix is dropped when the name already
 *  says it (e.g. "Campos ocultos"). */
export function hiddenGroupTitle(nome: string): string {
  return /\boculto/.test(norm(nome)) ? `Agrupamento: ${nome} (${HIDDEN_GROUP_HINT})` : `Agrupamento: ${nome} — ${HIDDEN_GROUP_SUFFIX} (${HIDDEN_GROUP_HINT})`;
}
