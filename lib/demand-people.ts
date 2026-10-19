/**
 * A demand has one or more analysts, requesters, departments and types (join tables DemandAnalyst /
 * DemandRequester / DemandDepartment / DemandDemandType). These helpers flatten the join rows for display/exports.
 */

type Named = { name: string };

export function demandAnalysts<T>(demand: { demandAnalysts?: { analyst: T }[] | null }): T[] {
  return demand.demandAnalysts?.map((link) => link.analyst) ?? [];
}

export function demandRequesters<T>(demand: { demandRequesters?: { requester: T }[] | null }): T[] {
  return demand.demandRequesters?.map((link) => link.requester) ?? [];
}

export function demandDepartments<T>(demand: { demandDepartments?: { department: T }[] | null }): T[] {
  return demand.demandDepartments?.map((link) => link.department) ?? [];
}

export function demandTypesOf<T>(demand: { demandDemandTypes?: { demandType: T }[] | null }): T[] {
  return demand.demandDemandTypes?.map((link) => link.demandType) ?? [];
}

/** "Ana, Bruno" — names in the given order, empty string when there are none. */
export function joinNames(items: Named[]): string {
  return items.map((item) => item.name).join(", ");
}

/** "a@x.com, b@x.com" — skips entries without an e-mail. */
export function joinEmails(items: { email?: string | null }[]): string {
  return items.map((item) => item.email).filter(Boolean).join(", ");
}
