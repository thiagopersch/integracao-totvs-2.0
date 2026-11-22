/** Plain-language reading of a form.io "Validação personalizada" script, for the RB-33 model.
 *
 *  The builder stores the rule as free JavaScript (`valid = …`), so this is best effort: a few
 *  patterns that cover most real scripts are recognised, and anything else says so plainly
 *  ("revisar o script") instead of guessing. `labelByKey` maps a form.io key (`data.<key>`) to the
 *  field's visible name; an unknown key is shown as the raw identifier. */

const FALLBACK = "Validação por código em JavaScript — regra não reconhecida automaticamente; revisar o script direto no campo.";

/** Every `data.key` / `data["key"]` / `data['key']` / `row.key` reference, in order, deduplicated. */
function referencedKeys(code: string): string[] {
  const keys: string[] = [];
  const re = /\b(?:data|row)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*['"]([^'"]+)['"]\s*\])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const key = m[1] ?? m[2];
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The first `<ref> ==/===/!=/!== <literal>` comparison on the given key. */
function comparisonOn(code: string, key: string): { op: "igual" | "diferente"; value: string } | undefined {
  const ref = `(?:data|row)\\s*(?:\\.\\s*${escapeRe(key)}\\b|\\[\\s*['"]${escapeRe(key)}['"]\\s*\\])`;
  const literal = `(?:'([^']*)'|"([^"]*)"|(true|false|-?\\d+(?:\\.\\d+)?))`;
  const forward = new RegExp(`${ref}\\s*(===?|!==?)\\s*${literal}`);
  const backward = new RegExp(`${literal}\\s*(===?|!==?)\\s*${ref}`);
  const f = forward.exec(code);
  if (f) return { op: f[1].startsWith("!") ? "diferente" : "igual", value: f[2] ?? f[3] ?? f[4] };
  const b = backward.exec(code);
  if (b) return { op: b[4].startsWith("!") ? "diferente" : "igual", value: b[1] ?? b[2] ?? b[3] };
  return undefined;
}

function describeValue(value: string): string {
  if (value === "true") return '"verdadeiro"';
  if (value === "false") return '"falso"';
  return `"${value}"`;
}

/** "o campo “Nacionalidade”" when the key resolves, "o campo com identificador “formaDeIngresso”" otherwise. */
function fieldRef(key: string, labelByKey: Map<string, string>): string {
  const label = labelByKey.get(key);
  return label ? `o campo “${label}”` : `o campo com identificador “${key}”`;
}

const CHECKS_EMPTY = /!\s*input\b|input\s*(?:===?|!==?)\s*(?:''|""|null|undefined)|input\s*\.\s*length\s*(?:===?\s*0|<\s*1)|!\s*\(?\s*input\s*&&|isEmpty\s*\(\s*input/;
const CLEARS_VALUE = /\.\s*setValue\s*\(\s*(?:''|""|null|\[\s*\]|false)\s*\)|\binput\s*=\s*(?:''|""|null)\s*;|\bvalue\s*=\s*(?:''|""|null)\s*;|resetValue\s*\(/;
const AGE = /getFullYear|\bidade\b|\bage\b|diff\s*\([^)]*['"]years?['"]|moment\s*\(/i;
const WORDS = /split\s*\(\s*(?:['"]\s['"]|\/\\s\+?\/)\s*\)/;

export function describeCustomValidation(code: string | undefined, labelByKey: Map<string, string> = new Map()): string {
  const src = (code ?? "").trim();
  if (!src) return FALLBACK;
  const keys = referencedKeys(src);

  if (CLEARS_VALUE.test(src)) {
    const key = keys[0];
    const cond = key ? ` quando ${fieldRef(key, labelByKey)} está desmarcado` : "";
    return `Ação automática: limpa o valor deste campo${cond} (não é uma checagem que gera erro).`;
  }

  if (AGE.test(src)) {
    const limit = /(?:<|>|<=|>=)\s*(\d{1,3})\b/.exec(src);
    return limit
      ? `Calcula a idade a partir da data informada neste campo e exige o limite ${limit[0].replace(/\s+/g, " ")} anos.`
      : "Calcula a idade a partir da data informada neste campo (não foi possível identificar automaticamente o limite exigido — revisar o script).";
  }

  if (WORDS.test(src) && keys.length === 0) {
    return "Verifica palavra por palavra do texto, rejeitando abreviações (pontuação no meio da palavra) ou palavras com uma letra só.";
  }

  if (CHECKS_EMPTY.test(src) && keys.length > 0) {
    const key = keys[0];
    const cmp = comparisonOn(src, key);
    if (cmp) {
      if (cmp.value === "true" && cmp.op === "igual") return `Torna este campo obrigatório quando ${fieldRef(key, labelByKey)} está marcado.`;
      return `Torna este campo obrigatório quando ${fieldRef(key, labelByKey)} for ${cmp.op === "igual" ? "igual a" : "diferente de"} ${describeValue(cmp.value)}.`;
    }
    // A bare truthiness test on the other field (`if (data.x && !input)`) reads as "is checked".
    const ref = `(?:data|row)\\s*(?:\\.\\s*${escapeRe(key)}\\b|\\[\\s*['"]${escapeRe(key)}['"]\\s*\\])`;
    // An opening paren right after a name is a call argument (`includes(data.x)`), not a test.
    if (new RegExp(`(?:&&|\\|\\||(?<![\\w$.\\]])\\(|^)\\s*${ref}\\s*(?:&&|\\)|\\?)`, "m").test(src)) {
      return `Torna este campo obrigatório quando ${fieldRef(key, labelByKey)} está marcado.`;
    }
    return `Torna este campo obrigatório dependendo do valor d${fieldRef(key, labelByKey)} (não foi possível identificar automaticamente o valor exigido — revisar o script).`;
  }

  return FALLBACK;
}
