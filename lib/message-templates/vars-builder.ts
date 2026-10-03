import { ERROR_KIND_LABELS, type ErrorKind } from "@/lib/error-kind";
import { formatHours, formatMonthLabel, USAGE_LEVEL_LABELS, type UsageLevel } from "@/lib/contract-usage";

/** Template variables resolved at send time — keys must match lib/message-templates/variable-catalog.ts. */
export type TemplateVars = Record<string, string>;

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
};

const DEMAND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const DEMAND_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Dates stored as UTC midnights / UTC wall-clock times (demand date, start/end, contract dates). */
const formatUtcDate = (date: Date) => date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
const formatUtcTime = (date: Date) =>
  date.toLocaleTimeString("pt-BR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
/** Real instants (now, failure time) — server-local time (process TZ = APP_TZ, see instrumentation.ts). */
const formatDateTime = (date: Date) =>
  date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

/** Variables every send has (merged first, so specific builders override them). */
export function buildGeneralVars(
  extra: { title?: string; message?: string; recipientName?: string; recipientEmail?: string } = {},
  now = new Date()
): TemplateVars {
  return {
    title: extra.title ?? "",
    message: extra.message ?? "",
    recipientName: extra.recipientName ?? "",
    recipientEmail: extra.recipientEmail ?? "",
    appUrl: appUrl(),
    currentDate: now.toLocaleDateString("pt-BR"),
    currentDateTime: formatDateTime(now),
    currentMonth: formatMonthLabel({ year: now.getFullYear(), month: now.getMonth() + 1 }),
  };
}

export function buildOrganizationVars(organization: { name: string; document?: string | null } | null): TemplateVars {
  return {
    organizationName: organization?.name ?? "",
    organizationDocument: organization?.document ?? "",
  };
}

export interface ClientVarsInput {
  name: string;
  legalName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  responsible?: string | null;
  site?: string | null;
  linkCrm?: string | null;
}

export function buildClientVars(client: ClientVarsInput): TemplateVars {
  return {
    clientName: client.name,
    clientLegalName: client.legalName ?? "",
    clientDocument: client.document ?? "",
    clientEmail: client.email ?? "",
    clientPhone: client.phone ?? "",
    clientResponsible: client.responsible ?? "",
    clientSite: client.site ?? "",
    clientCrmLink: client.linkCrm ?? "",
  };
}

export interface ContractUsageVarsInput {
  client: ClientVarsInput;
  usedHours: number;
  contractedHours: number;
  percent: number;
  level: UsageLevel;
  periodLabel: string;
  demandsCount?: number;
  /** Contracts in force during the month (earliest start / latest end are shown). */
  contracts: { startDate: Date; endDate: Date | null; status: string; contractedHours?: number; hourlyRate?: number | null; notes?: string | null }[];
}

export function buildContractUsageVars(input: ContractUsageVarsInput): TemplateVars {
  const balance = round2(input.contractedHours - input.usedHours);
  const starts = input.contracts.map((c) => c.startDate.getTime());
  const openEnded = input.contracts.some((c) => !c.endDate);
  const ends = input.contracts.filter((c) => c.endDate).map((c) => c.endDate!.getTime());
  const fmtPercent = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  // Hourly rate weighted by contracted hours over the contracts that have one.
  const priced = input.contracts.filter((c) => c.hourlyRate != null && c.hourlyRate > 0 && (c.contractedHours ?? 0) > 0);
  const pricedHours = priced.reduce((sum, c) => sum + (c.contractedHours ?? 0), 0);
  const contractedValue = priced.reduce((sum, c) => sum + (c.contractedHours ?? 0) * (c.hourlyRate ?? 0), 0);
  const rate = pricedHours > 0 ? contractedValue / pricedHours : null;

  return {
    ...buildClientVars(input.client),
    periodLabel: input.periodLabel,
    contractedHours: formatHours(input.contractedHours),
    usedHours: formatHours(input.usedHours),
    remainingHours: formatHours(Math.max(balance, 0)),
    exceededHours: formatHours(Math.max(-balance, 0)),
    usagePercent: fmtPercent(input.percent),
    remainingPercent: fmtPercent(Math.max(round2(100 - input.percent), 0)),
    usageLevel: USAGE_LEVEL_LABELS[input.level],
    demandsCount: input.demandsCount !== undefined ? String(input.demandsCount) : "",
    hourlyRate: rate !== null ? formatCurrency(rate) : "",
    contractedValue: rate !== null ? formatCurrency(contractedValue) : "",
    usedValue: rate !== null ? formatCurrency(input.usedHours * rate) : "",
    contractStartDate: starts.length ? formatUtcDate(new Date(Math.min(...starts))) : "",
    contractEndDate: openEnded || ends.length === 0 ? "Indeterminado" : formatUtcDate(new Date(Math.max(...ends))),
    contractStatus: [...new Set(input.contracts.map((c) => CONTRACT_STATUS_LABELS[c.status] ?? c.status))].join(", "),
    contractNotes: input.contracts.map((c) => c.notes?.trim()).filter(Boolean).join(" / "),
    isExceeded: balance < 0 ? "sim" : "",
  };
}

export interface DemandVarsInput {
  name: string;
  description: string;
  date: Date;
  startTime: Date | null;
  endTime: Date | null;
  durationMinutes: number;
  status: string;
  priority: string;
  demandType?: { name: string } | null;
  department?: { name: string } | null;
  analyst?: { name: string; email: string | null } | null;
  requester?: { name: string; email: string | null } | null;
}

/** The demand that triggered a consumption email (empty for manual resends/imports). */
export function buildDemandVars(demand: DemandVarsInput | null): TemplateVars {
  if (!demand) return {};
  return {
    demandName: demand.name,
    demandDescription: demand.description,
    demandDate: formatUtcDate(demand.date),
    demandStartTime: demand.startTime ? formatUtcTime(demand.startTime) : "",
    demandEndTime: demand.endTime ? formatUtcTime(demand.endTime) : "",
    demandHours: formatHours(round2(demand.durationMinutes / 60)),
    demandStatus: DEMAND_STATUS_LABELS[demand.status] ?? demand.status,
    demandPriority: DEMAND_PRIORITY_LABELS[demand.priority] ?? demand.priority,
    demandType: demand.demandType?.name ?? "",
    demandDepartment: demand.department?.name ?? "",
    demandAnalystName: demand.analyst?.name ?? "",
    demandAnalystEmail: demand.analyst?.email ?? "",
    demandRequesterName: demand.requester?.name ?? "",
    demandRequesterEmail: demand.requester?.email ?? "",
  };
}

/** Failure context stored in Notification.data by lib/notification-types.ts builders. */
export function buildFailureVars(
  data: Record<string, unknown> | null | undefined,
  extra: { occurredAt?: Date; tbcLink?: string | null } = {}
): TemplateVars {
  const d = data ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const kind = str(d.errorKind) as ErrorKind;
  return {
    clientName: str(d.clientName),
    errorMessage: str(d.errorMessage),
    errorKind: ERROR_KIND_LABELS[kind] ?? "",
    failureDate: extra.occurredAt ? formatDateTime(extra.occurredAt) : "",
    sourceLabel: str(d.sourceLabel),
    tbcName: str(d.tbcName),
    tbcLink: extra.tbcLink ?? "",
    method: str(d.method),
    wsName: str(d.wsName),
    filterLabel: str(d.filterLabel),
  };
}
