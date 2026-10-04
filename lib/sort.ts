/**
 * Sort comes straight from the URL (`?sort=field:dir`) into a Prisma `orderBy`. Only plain column
 * names are accepted, and never secret columns — sorting by `password` would leak the relative
 * order of stored credentials one page at a time.
 */
const SORT_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const BLOCKED_SORT_FIELDS = /password|secret|token|hash/i;

export function safeOrderBy(sort: { field: string; direction: string }): Record<string, "asc" | "desc"> {
  if (!SORT_FIELD_PATTERN.test(sort.field) || BLOCKED_SORT_FIELDS.test(sort.field)) {
    throw new Error("Ordenação inválida");
  }
  return { [sort.field]: sort.direction === "asc" ? "asc" : "desc" };
}
