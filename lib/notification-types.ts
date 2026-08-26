/**
 * Catalog for the newer, purpose-built notification types (failures that were previously silent).
 * Kept as a plain TS union — not a Prisma enum — so `Notification.type` stays a free-form string
 * and adding a new type here never needs a migration. Existing generic CRUD notifications built
 * inline in services/audit.service.ts (type `audit.<entity>.<action>`) are untouched.
 */
export const NOTIFICATION_TYPES = {
  BACKUP_RUN_FAILED: "backup.run.failed",
  SOAP_CALL_FAILED: "soap.call.failed",
  AUTH_LOGIN_SUSPICIOUS: "auth.login.suspicious",
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
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.BACKUP_RUN_FAILED,
    title: `Falha no backup — ${params.filterLabel}`,
    body: `O backup do filtro "${params.filterLabel}" (TBC ${params.tbcName}) falhou: ${params.errorMessage}`,
    data: { filterId: params.filterId, href: `/admin/backups/${params.filterId}` },
  };
}

export function buildSoapCallFailedNotification(params: {
  method: string;
  wsName: string;
  errorMessage: string;
}): BuiltNotification {
  return {
    type: NOTIFICATION_TYPES.SOAP_CALL_FAILED,
    title: `Falha na chamada SOAP — ${params.method}`,
    body: `A chamada ${params.method} (${params.wsName}) falhou: ${params.errorMessage}`,
    data: { href: "/soap/history" },
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
