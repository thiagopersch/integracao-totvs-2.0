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
    body: `O backup do filtro "${params.filterLabel}" (TBC ${params.tbcName}) falhou: ${params.errorMessage}`,
    data: {
      filterId: params.filterId,
      href: `/admin/backups/${params.filterId}`,
      source: "filter",
      sourceLabel: "Filtro (Backup)",
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
    body: `O backup agendado do filtro "${params.filterLabel}" (TBC ${params.tbcName}) foi concluído com sucesso.`,
    data: {
      filterId: params.filterId,
      href: `/admin/backups/${params.filterId}`,
      source: "filter",
      sourceLabel: "Filtro (Backup)",
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

export function buildLoginSuspiciousNotification(params: { email: string; attempts: number }): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.AUTH_LOGIN_SUSPICIOUS,
    title: "Tentativas de login suspeitas",
    body: `${params.attempts} tentativas de login falharam para o usuário ${params.email} nos últimos 15 minutos.`,
    data: { email: params.email, href: "/admin/users" },
  };
}
