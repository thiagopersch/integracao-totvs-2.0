/** Normalizes for comparison: lowercase, strip accents, collapse whitespace. */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** 1 = identical, 0 = completely different. */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface FuzzyCandidate {
  id: string;
  name: string;
  /** Extra names to also try an exact/substring match against (e.g. Client.legalName). */
  aliases?: (string | null | undefined)[];
}

export type FuzzyMatchStatus = "matched" | "ambiguous" | "unmatched";

export interface FuzzyMatchResult {
  status: FuzzyMatchStatus;
  matchedId: string | null;
  candidates: { id: string; label: string }[];
}

const FUZZY_THRESHOLD = 0.82;
const AMBIGUITY_MARGIN = 0.03;

/**
 * Resolves free-text spreadsheet values against known DB records without any persisted alias
 * table — recomputed from scratch on every import. Tries, in order: exact match, case/accent
 * -insensitive exact match, substring/token containment, then fuzzy (Levenshtein) similarity.
 */
export function matchName(rawValue: string, candidates: FuzzyCandidate[]): FuzzyMatchResult {
  const raw = rawValue.trim();
  if (!raw) return { status: "unmatched", matchedId: null, candidates: [] };

  const exact = candidates.find((c) => c.name === raw || c.aliases?.some((a) => a === raw));
  if (exact) return { status: "matched", matchedId: exact.id, candidates: [] };

  const normalizedRaw = normalize(raw);
  const normalizedInsensitive = candidates.find(
    (c) => normalize(c.name) === normalizedRaw || c.aliases?.some((a) => a && normalize(a) === normalizedRaw)
  );
  if (normalizedInsensitive) return { status: "matched", matchedId: normalizedInsensitive.id, candidates: [] };

  const rawTokens = normalizedRaw.split(" ").filter(Boolean);
  const substringMatches = candidates.filter((c) => {
    const names = [c.name, ...(c.aliases ?? [])].filter(Boolean) as string[];
    return names.some((n) => {
      const normalizedName = normalize(n);
      if (normalizedName.includes(normalizedRaw) || normalizedRaw.includes(normalizedName)) return true;
      const nameTokens = normalizedName.split(" ").filter(Boolean);
      return rawTokens.length > 0 && rawTokens.every((t) => nameTokens.includes(t));
    });
  });
  if (substringMatches.length === 1) return { status: "matched", matchedId: substringMatches[0].id, candidates: [] };
  if (substringMatches.length > 1) {
    return {
      status: "ambiguous",
      matchedId: null,
      candidates: substringMatches.slice(0, 3).map((c) => ({ id: c.id, label: c.name })),
    };
  }

  const scored = candidates
    .map((c) => ({ id: c.id, label: c.name, score: similarity(normalizedRaw, normalize(c.name)) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < FUZZY_THRESHOLD) return { status: "unmatched", matchedId: null, candidates: [] };

  const tied = scored.filter((c) => best.score - c.score <= AMBIGUITY_MARGIN);
  if (tied.length > 1) {
    return { status: "ambiguous", matchedId: null, candidates: tied.slice(0, 3).map((c) => ({ id: c.id, label: c.label })) };
  }

  return { status: "matched", matchedId: best.id, candidates: [] };
}
