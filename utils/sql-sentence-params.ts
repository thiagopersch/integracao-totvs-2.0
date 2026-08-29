/**
 * TOTVS RM SQL sentences declare parameters with a leading colon (":PARAM"), following the same
 * identifier rule as SQL: a letter or underscore, then any run of letters/digits/underscores.
 * Requiring a leading letter/underscore after the colon is what keeps this from misfiring on time
 * literals embedded in the sentence text (e.g. '10:00:00' — the character after each colon there
 * is a digit, so it's never matched).
 */
const SENTENCE_PARAM_REGEX = /:([A-Za-z_][A-Za-z0-9_]*)/g;

/** Extracts every distinct `:PARAM` reference from a sentence's SQL text, in first-occurrence order. */
export function extractSentenceParameters(sql: string): string[] {
  const seen = new Set<string>();
  const params: string[] = [];
  for (const match of sql.matchAll(SENTENCE_PARAM_REGEX)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      params.push(name);
    }
  }
  return params;
}
