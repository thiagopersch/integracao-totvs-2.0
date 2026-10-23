import type { ErrorKind } from "@/lib/error-kind";

/**
 * Catalog for the newer, purpose-built notification types (failures that were previously silent).
 * Kept as a plain TS union — not a Prisma enum — so `Notification.type` stays a free-form string
 * and adding a new type here never needs a migration. Existing generic CRUD notifications built
 * inline in services/audit.service.ts (type `audit.<entity>.<action>`) are untouched.
 */
export const NOTIFICATION_TYPES = {
  BACKUP_RUN_FAILED: "backup.run.failed",
  BACKUP_RUN_SUCCEEDED: "backup.run.succeeded",
  SOAP_CALL_FAILED: "soap.call.failed",
  AUTH_LOGIN_SUSPICIOUS: "auth.login.suspicious",
  INTEGRATION_TEST_FAILED: "integrations.test.failed",
  CONTRACT_USAGE_THRESHOLD: "contracts.usage.threshold",
  PROJECT_TASK_ASSIGNED: "projects.task.assigned",
  PROJECT_TASK_DUE_SOON: "projects.task.due_soon",
  PROJECT_TASK_OVERDUE: "projects.task.overdue",
  PROJECT_TASK_DUE_DIGEST: "projects.task.due_digest",
  SHEET_SYNC_FAILED: "integrations.sheet_sync.failed",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface BuiltNotification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export function buildBackupRunFailedNotification(params: {
  filterId: string;
  filterLabel: string;
  tbcName: string;
  errorMessage: string;
  clientId?: string;
  clientName?: string;
  errorKind?: ErrorKind;
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.BACKUP_RUN_FAILED,
    title: `Falha no backup — ${params.filterLabel}`,
    body: `O backup do filtro para backup "${params.filterLabel}" falhou: ${params.errorMessage}`,
    data: {
      filterId: params.filterId,
      href: `/admin/backups/${params.filterId}`,
      filterLabel: params.filterLabel,
      source: "filter",
      sourceLabel: "Filtro para backup",
      tbcName: params.tbcName,
      clientId: params.clientId,
      clientName: params.clientName,
      errorMessage: params.errorMessage,
      errorKind: params.errorKind,
    },
  };
}

export function buildBackupRunSucceededNotification(params: {
  filterId: string;
  filterLabel: string;
  tbcName: string;
  clientId?: string;
  clientName?: string;
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.BACKUP_RUN_SUCCEEDED,
    title: `Backup concluído — ${params.filterLabel}`,
    body: `O backup agendado do filtro para backup "${params.filterLabel}" foi concluído com sucesso.`,
    data: {
      filterId: params.filterId,
      href: `/admin/backups/${params.filterId}`,
      filterLabel: params.filterLabel,
      source: "filter",
      sourceLabel: "Filtro para backup",
      tbcName: params.tbcName,
      clientId: params.clientId,
      clientName: params.clientName,
    },
  };
}

export function buildSoapCallFailedNotification(params: {
  method: string;
  wsName: string;
  sourceLabel: string;
  errorMessage: string;
  errorKind?: ErrorKind;
  clientId?: string;
  clientName?: string;
  tbcName?: string;
  logId?: string;
  url?: string;
  entityType?: "dataserver" | "process";
  entityName?: string;
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.SOAP_CALL_FAILED,
    title: `Falha na chamada SOAP — ${params.method}`,
    body: `A chamada ${params.method} (${params.wsName}) falhou: ${params.errorMessage}`,
    data: {
      href: "/admin/activity?source=SOAP",
      source: "soap",
      sourceLabel: params.sourceLabel,
      method: params.method,
      wsName: params.wsName,
      tbcName: params.tbcName,
      clientId: params.clientId,
      clientName: params.clientName,
      errorMessage: params.errorMessage,
      errorKind: params.errorKind,
      logId: params.logId,
      url: params.url,
      entityType: params.entityType,
      entityName: params.entityName,
    },
  };
}

export function buildIntegrationTestFailedNotification(params: {
  integration: string;
  errorMessage: string;
  errorKind?: ErrorKind;
  url?: string;
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.INTEGRATION_TEST_FAILED,
    title: `Falha ao testar integração — ${params.integration}`,
    body: `O teste de conexão com ${params.integration} falhou: ${params.errorMessage}`,
    data: {
      integration: params.integration,
      href: `/integrations/${params.integration.toLowerCase()}`,
      source: "api",
      sourceLabel: `Integração (API) — ${params.integration}`,
      errorMessage: params.errorMessage,
      errorKind: params.errorKind,
      url: params.url,
    },
  };
}

export function buildSheetSyncFailedNotification(params: {
  syncName: string;
  errorMessage: string;
  errorKind?: ErrorKind;
  url?: string;
  clientId?: string;
  clientName?: string;
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.SHEET_SYNC_FAILED,
    title: `Falha ao atualizar planilha — ${params.syncName}`,
    body: `A atualização da planilha Google "${params.syncName}" falhou: ${params.errorMessage}`,
    data: {
      href: "/integrations/sheet-syncs",
      source: "api",
      sourceLabel: "Integração (API) — Google Sheets",
      clientId: params.clientId,
      clientName: params.clientName,
      errorMessage: params.errorMessage,
      errorKind: params.errorKind,
      url: params.url,
    },
  };
}

export function buildLoginSuspiciousNotification(params: { email: string; attempts: number }): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.AUTH_LOGIN_SUSPICIOUS,
    title: "Tentativas de login suspeitas",
    body: `${params.attempts} tentativas de login falharam para o usuário ${params.email} nos últimos 15 minutos.`,
    data: { email: params.email, href: "/admin/users" },
  };
}

export function buildContractUsageThresholdNotification(params: {
  clientId: string;
  clientName: string;
  threshold: number;
  percent: number;
  usedHours: number;
  /** Month's total: allowance (`baseHours`) + extra hours launched for the month (`extraHours`). */
  contractedHours: number;
  baseHours?: number;
  extraHours?: number;
  period: string;
  periodLabel: string;
}): BuiltNotification {
  const exceeded = params.threshold >= 100;
  const percentLabel = `${params.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const hoursLabel = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}h`;
  return {
    type: NOTIFICATION_TYPES.CONTRACT_USAGE_THRESHOLD,
    title: exceeded
      ? `Contrato excedido — ${params.clientName} (${percentLabel})`
      : `Contrato em atenção — ${params.clientName} (${percentLabel})`,
    body: `O consumo de horas do contrato de ${params.clientName} em ${params.periodLabel} ${
      exceeded ? "excedeu o contratado e chegou a" : "atingiu"
    } ${percentLabel}: ${hoursLabel(params.usedHours)} de ${hoursLabel(params.contractedHours)}${
      params.extraHours
        ? ` (${hoursLabel(params.baseHours ?? params.contractedHours - params.extraHours)} contratadas + ${hoursLabel(params.extraHours)} extras)`
        : ""
    }.`,
    data: {
      href: "/contracts",
      source: "contract",
      sourceLabel: "Contrato (Consumo de horas)",
      clientId: params.clientId,
      clientName: params.clientName,
      threshold: params.threshold,
      percent: params.percent,
      usedHours: params.usedHours,
      contractedHours: params.contractedHours,
      ...(params.extraHours ? { baseHours: params.baseHours, extraHours: params.extraHours } : {}),
      period: params.period,
      periodLabel: params.periodLabel,
    },
  };
}

type ProjectTaskRef = {
  projectId: string;
  projectCode: string;
  projectName: string;
  taskId: string;
  taskNumber: number;
  taskTitle: string;
};

function projectTaskHref(ref: Pick<ProjectTaskRef, "projectId" | "taskId">) {
  return `/projetos/gestao/${ref.projectId}?task=${ref.taskId}`;
}

function projectTaskData(ref: ProjectTaskRef, extra: Record<string, unknown> = {}) {
  return {
    href: projectTaskHref(ref),
    source: "project",
    sourceLabel: `Projeto ${ref.projectCode} — ${ref.projectName}`,
    projectId: ref.projectId,
    taskId: ref.taskId,
    ...extra,
  };
}

const formatDueDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(date);

export function buildProjectTaskAssignedNotification(params: ProjectTaskRef & { assignedBy: string; dueDate: Date | null }): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.PROJECT_TASK_ASSIGNED,
    title: `Nova tarefa: ${params.projectCode}-${params.taskNumber} ${params.taskTitle}`,
    body: `${params.assignedBy} atribuiu a você a tarefa "${params.taskTitle}" do projeto ${params.projectName}${
      params.dueDate ? `, com prazo em ${formatDueDate(params.dueDate)}` : ""
    }.`,
    data: projectTaskData(params),
  };
}

export function buildProjectTaskDueSoonNotification(params: ProjectTaskRef & { dueDate: Date; daysLeft: number }): BuiltNotification {
  const when = params.daysLeft === 0 ? "vence hoje" : params.daysLeft === 1 ? "vence amanhã" : `vence em ${params.daysLeft} dias`;
  return {
    type: NOTIFICATION_TYPES.PROJECT_TASK_DUE_SOON,
    title: `Prazo próximo: ${params.projectCode}-${params.taskNumber} ${params.taskTitle}`,
    body: `A tarefa "${params.taskTitle}" do projeto ${params.projectName} ${when} (${formatDueDate(params.dueDate)}).`,
    data: projectTaskData(params, { dueDate: params.dueDate.toISOString() }),
  };
}

export function buildProjectTaskOverdueNotification(params: ProjectTaskRef & { dueDate: Date; daysLate: number }): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.PROJECT_TASK_OVERDUE,
    title: `Tarefa atrasada: ${params.projectCode}-${params.taskNumber} ${params.taskTitle}`,
    body: `A tarefa "${params.taskTitle}" do projeto ${params.projectName} venceu em ${formatDueDate(params.dueDate)} (${params.daysLate} dia(s) de atraso).`,
    data: projectTaskData(params, { dueDate: params.dueDate.toISOString() }),
  };
}

export function buildProjectTaskDueDigestNotification(params: { dueSoon: number; overdue: number; tasks: string[] }): BuiltNotification {
  const parts = [
    params.overdue ? `${params.overdue} tarefa(s) atrasada(s)` : "",
    params.dueSoon ? `${params.dueSoon} tarefa(s) com prazo próximo` : "",
  ].filter(Boolean);
  return {
    type: NOTIFICATION_TYPES.PROJECT_TASK_DUE_DIGEST,
    title: `Prazos de projetos: ${parts.join(" e ")}`,
    body: `Você tem ${parts.join(" e ")}: ${params.tasks.slice(0, 5).join("; ")}${params.tasks.length > 5 ? "; …" : ""}.`,
    data: { href: "/projetos/gestao?mine=true", source: "project", sourceLabel: "Gestão de Projetos" },
  };
}
