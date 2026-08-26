"use server";

import { emailSettingsService } from "@/services/email-settings.service";
import { requirePermission } from "@/lib/rbac";

export async function getEmailSettings() {
  const { organizationId } = await requirePermission("integrations", "execute");
  const settings = await emailSettingsService.get(organizationId);
  if (!settings) return null;
  // Password is write-only from the client's perspective — never round-tripped back, same
  // convention as the Tbc edit form (empty field on load, only updated if the user types a new one).
  return {
    id: settings.id,
    host: settings.host,
    port: settings.port,
    user: settings.user,
    from: settings.from,
    enabled: settings.enabled,
  };
}

export async function saveEmailSettings(formData: FormData) {
  const { organizationId } = await requirePermission("integrations", "execute");

  const host = (formData.get("host") as string) || "";
  const port = Number(formData.get("port"));
  const user = (formData.get("user") as string) || "";
  const password = (formData.get("password") as string) || "";
  const from = (formData.get("from") as string) || "";
  const enabled = formData.get("enabled") === "true";

  if (!host || !port || !user || !from) {
    return { success: false, error: "Preencha todos os campos obrigatórios" };
  }

  try {
    await emailSettingsService.save(organizationId, { host, port, user, password: password || undefined, from, enabled });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
