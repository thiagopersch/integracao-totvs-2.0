import { FileText, Radio, Archive, ShieldCheck, Plug, Bell, type LucideIcon } from "lucide-react";

export type NotificationCategory = { label: string; icon: LucideIcon };

/** Derives a display category from the `type` prefix (e.g. `audit.demand.create` → "audit") —
 *  shared between the popover, the notifications table, and the detail dialog so all three agree
 *  on the same icon/label per notification type. */
const CATEGORIES: Record<string, NotificationCategory> = {
  audit: { label: "Registro", icon: FileText },
  soap: { label: "SOAP", icon: Radio },
  backup: { label: "Backup", icon: Archive },
  auth: { label: "Segurança", icon: ShieldCheck },
  integrations: { label: "Integração", icon: Plug },
};

export function getNotificationCategory(type: string): NotificationCategory {
  const prefix = type.split(".")[0];
  return CATEGORIES[prefix] ?? { label: "Sistema", icon: Bell };
}
