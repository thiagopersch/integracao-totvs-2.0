/**
 * Cliente → Solicitantes → Setores cascade of the demand form: a requester belongs to one client
 * and a department applies to one or more clients (DepartmentClient) and is linked to one or more
 * requesters (DepartmentRequester). Pure so the form, the
 * server-side validation and the tests share the same rules.
 */

export type CascadeRequester = { id: string; clientId: string | null };
export type CascadeDepartment = { id: string; clientIds: string[]; requesterIds: string[] };

/** Requesters selectable for the client; `keepIds` (already saved on the demand) stay listed even if legacy/unlinked. */
export function requestersForClient<T extends CascadeRequester>(requesters: T[], clientId: string, keepIds: string[] = []): T[] {
  if (!clientId) return requesters.filter((r) => keepIds.includes(r.id));
  return requesters.filter((r) => r.clientId === clientId || keepIds.includes(r.id));
}

/** Departments of the client linked to any of the selected requesters (union); `keepIds` stay listed as above. */
export function departmentsForRequesters<T extends CascadeDepartment>(
  departments: T[],
  clientId: string,
  requesterIds: string[],
  keepIds: string[] = [],
): T[] {
  const selected = new Set(requesterIds);
  return departments.filter(
    (d) => (d.clientIds.includes(clientId) && d.requesterIds.some((id) => selected.has(id))) || keepIds.includes(d.id),
  );
}

/** Drops selected ids that are no longer among the options. */
export function pruneSelection(selectedIds: string[], options: { id: string }[]): string[] {
  const allowed = new Set(options.map((o) => o.id));
  return selectedIds.filter((id) => allowed.has(id));
}

/** Nothing selected and exactly one option → that option is picked; otherwise the selection is kept as-is. */
export function autoPickSingle(selectedIds: string[], options: { id: string }[]): string[] {
  return selectedIds.length === 0 && options.length === 1 ? [options[0].id] : selectedIds;
}
