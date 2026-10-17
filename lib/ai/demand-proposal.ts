import { createDemandSchema } from "@/schemas/demand.schema";

/** Client-safe: shared by the assistant service and the preview cards. */
export const PROPOSAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const PROPOSAL_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export interface DemandProposalFields {
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  priority: (typeof PROPOSAL_PRIORITIES)[number];
  status: (typeof PROPOSAL_STATUSES)[number];
  notes: string;
  clientId: string;
  analystId: string;
  requesterId: string;
  departmentId: string;
  demandTypeId: string;
}

/** One demand proposed by the AI, already checked against the catalogs and createDemandSchema. */
export interface DemandProposal extends DemandProposalFields {
  /** Field → message for what still needs fixing before it can be created. */
  errors: Record<string, string>;
}

/** Same rules as createDemand (schema + "only for yourself" analyst scope). */
export function validateProposal(p: DemandProposalFields, analystScope?: string | null): Record<string, string> {
  const errors: Record<string, string> = {};
  const parsed = createDemandSchema.safeParse({ ...p, notes: p.notes || undefined, tagIds: [] });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  }
  if (analystScope && p.analystId && p.analystId !== analystScope) errors.analystId = "Você só pode lançar demandas para si mesmo";
  return errors;
}

/** FormData accepted by actions/demands.ts#createDemand. */
export function proposalToFormData(p: DemandProposalFields): FormData {
  const fd = new FormData();
  const fields: (keyof DemandProposalFields)[] = [
    "name",
    "description",
    "date",
    "startTime",
    "endTime",
    "priority",
    "status",
    "notes",
    "clientId",
    "analystId",
    "requesterId",
    "departmentId",
    "demandTypeId",
  ];
  for (const key of fields) fd.append(key, p[key]);
  return fd;
}
