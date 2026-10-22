import { ERROR_KIND_LABELS, type ErrorKind } from "@/lib/error-kind";
import { demandMinutesByStatus, formatHours, formatMonthLabel, usagePercent, USAGE_LEVEL_LABELS, type UsageLevel } from "@/lib/contract-usage";
import { demandAnalysts, demandDepartments, demandRequesters, demandTypesOf, joinEmails, joinNames } from "@/lib/demand-people";

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
const fmtPercent = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
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
  /** Month's total (allowance + extra hours). */
  contractedHours: number;
  /** Contracts' monthly allowance / extra hours launched for the month — default to total / 0. */
  baseHours?: number;
  extraHours?: number;
  percent: number;
  level: UsageLevel;
  periodLabel: string;
  demandsCount?: number;
  /** Contracts in force during the month (earliest start / latest end are shown). */
  contracts: { startDate: Date; endDate: Date | null; status: string; notes?: string | null }[];
  /** Hours worked in the month per analyst, priced by each analyst's own hourly rate. */
  analystUsage?: { hours: number; hourlyRate: number | null }[];
}

export function buildContractUsageVars(input: ContractUsageVarsInput): TemplateVars {
  const balance = round2(input.contractedHours - input.usedHours);
  const starts = input.contracts.map((c) => c.startDate.getTime());
  const openEnded = input.contracts.some((c) => !c.endDate);
  const ends = input.contracts.filter((c) => c.endDate).map((c) => c.endDate!.getTime());

  // Used value = Σ analyst hours × analyst hourly rate; the average rate (weighted by those hours)
  // prices the contracted hours.
  const priced = (input.analystUsage ?? []).filter((a) => a.hourlyRate != null && a.hourlyRate > 0 && a.hours > 0);
  const pricedHours = priced.reduce((sum, a) => sum + a.hours, 0);
  const usedValue = priced.reduce((sum, a) => sum + a.hours * (a.hourlyRate ?? 0), 0);
  const rate = pricedHours > 0 ? usedValue / pricedHours : null;

  return {
    ...buildClientVars(input.client),
    periodLabel: input.periodLabel,
    contractedHours: formatHours(input.contractedHours),
    baseHours: formatHours(input.baseHours ?? input.contractedHours - (input.extraHours ?? 0)),
    extraHours: formatHours(input.extraHours ?? 0),
    usedHours: formatHours(input.usedHours),
    remainingHours: formatHours(Math.max(balance, 0)),
    exceededHours: formatHours(Math.max(-balance, 0)),
    usagePercent: fmtPercent(input.percent),
    remainingPercent: fmtPercent(Math.max(round2(100 - input.percent), 0)),
    usageLevel: USAGE_LEVEL_LABELS[input.level],
    demandsCount: input.demandsCount !== undefined ? String(input.demandsCount) : "",
    hourlyRate: rate !== null ? formatCurrency(rate) : "",
    contractedValue: rate !== null ? formatCurrency(input.contractedHours * rate) : "",
    usedValue: rate !== null ? formatCurrency(usedValue) : "",
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
  demandDemandTypes?: { demandType: { name: string } }[];
  demandDepartments?: { department: { name: string } }[];
  demandAnalysts?: { analyst: { name: string; email: string | null } }[];
  demandRequesters?: { requester: { name: string; email: string | null } }[];
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
    demandType: joinNames(demandTypesOf(demand)),
    // Several analysts/requesters/departments → comma-separated, in name order.
    demandDepartment: joinNames(demandDepartments(demand)),
    demandAnalystName: joinNames(demandAnalysts(demand)),
    demandAnalystEmail: joinEmails(demandAnalysts(demand)),
    demandRequesterName: joinNames(demandRequesters(demand)),
    demandRequesterEmail: joinEmails(demandRequesters(demand)),
  };
}

export interface DemandReportVarsInput {
  client: ClientVarsInput;
  period: { label: string; startLabel: string; endLabel: string; slug: string };
  demands: { durationMinutes: number; status?: string | null; demandAnalysts?: { analyst: { name: string } }[] }[];
  /** The client's contract allowance for the report's reference month (getMonthlyUsage) — absent without a contract. */
  usage?: ContractAllowance | null;
}

/** Monthly allowance of a client: contract hours + extra hours launched for the month. */
export interface ContractAllowance {
  baseHours: number;
  extraHours: number;
  contractedHours: number;
}

const NO_CONTRACT = "—";

/** Executed/scheduled hours and the contract figures (consumption = executed ÷ contract + extras). */
function demandReportHoursVars(demands: { durationMinutes: number; status?: string | null }[], usage: ContractAllowance | null | undefined) {
  const { executedMinutes, scheduledMinutes } = demandMinutesByStatus(demands);
  const executed = round2(executedMinutes / 60);
  return {
    executedHours: formatHours(executed),
    scheduledHours: formatHours(round2(scheduledMinutes / 60)),
    contractBaseHours: usage ? formatHours(usage.baseHours) : NO_CONTRACT,
    contractExtraHours: usage ? formatHours(usage.extraHours) : NO_CONTRACT,
    contractTotalHours: usage ? formatHours(usage.contractedHours) : NO_CONTRACT,
    contractUsagePercent: usage && usage.contractedHours > 0 ? fmtPercent(usagePercent(executed, usage.contractedHours)) : NO_CONTRACT,
  };
}

/** A client's demands in the report period (DEMAND_REPORT event). `attachmentNames` is added by the sender. */
export function buildDemandReportVars(input: DemandReportVarsInput): TemplateVars {
  const minutes = input.demands.reduce((sum, d) => sum + d.durationMinutes, 0);
  const analysts = [...new Set(input.demands.flatMap((d) => demandAnalysts(d).map((a) => a.name)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    ...buildClientVars(input.client),
    periodLabel: input.period.label,
    periodStart: input.period.startLabel,
    periodEnd: input.period.endLabel,
    periodSlug: input.period.slug,
    demandsCount: String(input.demands.length),
    totalHours: formatHours(round2(minutes / 60)),
    analystsNames: analysts.join(", "),
    ...demandReportHoursVars(input.demands, input.usage),
  };
}

export interface AllClientsDemandReportVarsInput {
  period: { label: string; startLabel: string; endLabel: string; slug: string };
  clients: { durationMinutes: number; status?: string | null }[][];
  /** Each client's allowance, aligned with `clients` (null without a contract). The grand contract
   *  totals and consumption % only count the clients that have one. */
  usage?: (ContractAllowance | null | undefined)[];
}

/** Totals of an ALL_CLIENTS demands report — each client's own vars come from buildDemandReportVars. */
export function buildAllClientsDemandReportVars(input: AllClientsDemandReportVarsInput): TemplateVars {
  const demands = input.clients.flat();
  const minutes = demands.reduce((sum, d) => sum + d.durationMinutes, 0);
  const contracted = input.clients.flatMap((clientDemands, i) => {
    const usage = input.usage?.[i];
    return usage ? [{ usage, clientDemands }] : [];
  });
  const totals: ContractAllowance | null = contracted.length
    ? {
        baseHours: round2(contracted.reduce((sum, c) => sum + c.usage.baseHours, 0)),
        extraHours: round2(contracted.reduce((sum, c) => sum + c.usage.extraHours, 0)),
        contractedHours: round2(contracted.reduce((sum, c) => sum + c.usage.contractedHours, 0)),
      }
    : null;
  const contractHours = demandReportHoursVars(contracted.flatMap((c) => c.clientDemands), totals);
  const hours = demandReportHoursVars(demands, null);
  return {
    periodLabel: input.period.label,
    periodStart: input.period.startLabel,
    periodEnd: input.period.endLabel,
    periodSlug: input.period.slug,
    clientsCount: String(input.clients.length),
    grandDemandsCount: String(demands.length),
    grandTotalHours: formatHours(round2(minutes / 60)),
    grandExecutedHours: hours.executedHours,
    grandScheduledHours: hours.scheduledHours,
    grandContractBaseHours: contractHours.contractBaseHours,
    grandExtraHours: contractHours.contractExtraHours,
    grandContractTotalHours: contractHours.contractTotalHours,
    grandUsagePercent: contractHours.contractUsagePercent,
  };
}

export interface AllClientsUsageVarsInput {
  period: { label: string; slug: string };
  usage: { contractedHours: number; usedHours: number; demandsCount: number }[];
}

/** Totals of an ALL_CLIENTS consumption email — each client's own vars come from buildContractUsageVars. */
export function buildAllClientsUsageVars(input: AllClientsUsageVarsInput): TemplateVars {
  const contracted = round2(input.usage.reduce((sum, u) => sum + u.contractedHours, 0));
  const used = round2(input.usage.reduce((sum, u) => sum + u.usedHours, 0));
  return {
    periodLabel: input.period.label,
    periodSlug: input.period.slug,
    clientsCount: String(input.usage.length),
    grandDemandsCount: String(input.usage.reduce((sum, u) => sum + u.demandsCount, 0)),
    grandTotalHours: formatHours(used),
    grandContractedHours: formatHours(contracted),
    grandUsedHours: formatHours(used),
    grandRemainingHours: formatHours(Math.max(round2(contracted - used), 0)),
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
