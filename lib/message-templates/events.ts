/** Mirrors the Prisma enums (kept as plain unions so this file is safe for client components). */
export type MessageChannel = "EMAIL" | "WHATSAPP";
export type MessageTemplateEvent = "CONTRACT_USAGE" | "BACKUP_FAILED" | "SOAP_FAILED" | "GENERAL";

export const MESSAGE_CHANNEL_LABELS: Record<MessageChannel, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
};

export const MESSAGE_CHANNEL_COLORS: Record<MessageChannel, string> = {
  EMAIL: "#3b82f6",
  WHATSAPP: "#22c55e",
};

export const MESSAGE_EVENT_LABELS: Record<MessageTemplateEvent, string> = {
  CONTRACT_USAGE: "Consumo de horas do contrato",
  BACKUP_FAILED: "Falha de backup",
  SOAP_FAILED: "Falha na chamada SOAP",
  GENERAL: "Geral / Automação",
};

export const MESSAGE_EVENT_DESCRIPTIONS: Record<MessageTemplateEvent, string> = {
  CONTRACT_USAGE:
    "Enviado ao atingir 80% ou mais das horas do mês (a cada nova demanda) e no reenvio manual pela tabela de contratos.",
  BACKUP_FAILED: "E-mail das notificações de falha de backup (para usuários com e-mail ativado no perfil).",
  SOAP_FAILED: "E-mail das notificações de falha em chamadas SOAP (para usuários com e-mail ativado no perfil).",
  GENERAL: "Usado nos demais e-mails de notificação do sistema, com {{title}} e {{message}}.",
};

/** Grouped options for the event select (same visual as the reference: section headers). */
export const MESSAGE_EVENT_GROUPS: { label: string; events: MessageTemplateEvent[] }[] = [
  { label: "Contratos", events: ["CONTRACT_USAGE"] },
  { label: "Falhas", events: ["BACKUP_FAILED", "SOAP_FAILED"] },
  { label: "Outros", events: ["GENERAL"] },
];

export const MESSAGE_CHANNELS: MessageChannel[] = ["EMAIL", "WHATSAPP"];
export const MESSAGE_EVENTS: MessageTemplateEvent[] = ["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED", "GENERAL"];

/** Notification type (lib/notification-types.ts) → template event used for its email. */
export function eventForNotificationType(type: string): MessageTemplateEvent {
  if (type === "backup.run.failed") return "BACKUP_FAILED";
  if (type === "soap.call.failed") return "SOAP_FAILED";
  // contracts.usage.threshold also lands here: its client-facing email (CONTRACT_USAGE) is sent by
  // contract-usage.service — the copy users get via their notification preference is a generic one.
  return "GENERAL";
}
