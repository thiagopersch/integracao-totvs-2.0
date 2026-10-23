"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { parseSpreadsheetId } from "@/lib/google-sheets";
import { auditService } from "@/services/audit.service";
import { googleSettingsService } from "@/services/google-settings.service";

const googleSettingsSchema = z.object({
  serviceAccountJson: z.string().trim().max(20_000, "Chave muito grande").optional(),
  enabled: z.boolean(),
});

export async function getGoogleSettings() {
  const { organizationId } = await requirePermission("integrations", "execute");
  const settings = await googleSettingsService.get(organizationId);
  // The key is write-only: only the service account e-mail goes back to the browser.
  return settings ? { serviceAccountEmail: settings.serviceAccountEmail, enabled: settings.enabled } : null;
}

export async function saveGoogleSettings(input: unknown) {
  const { organizationId, userId } = await requirePermission("integrations", "execute");
  const parsed = googleSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  try {
    const { serviceAccountJson, enabled } = parsed.data;
    const settings = await googleSettingsService.save(organizationId, { serviceAccountJson: serviceAccountJson || undefined, enabled });
    await auditService.log({
      action: "UPDATE",
      entity: "GoogleSettings",
      entityId: organizationId,
      organizationId,
      userId,
      newData: { serviceAccountEmail: settings.serviceAccountEmail, enabled, keyChanged: !!serviceAccountJson },
    });
    return { success: true, serviceAccountEmail: settings.serviceAccountEmail };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/** Opens the spreadsheet with the saved key — proves the key works and the sheet is shared. */
export async function testGoogleSheetAccess(spreadsheetUrl: string) {
  const { organizationId } = await requirePermission("sheet_syncs", "read");
  const spreadsheetId = parseSpreadsheetId(String(spreadsheetUrl ?? ""));
  if (!spreadsheetId) return { success: false, error: "Informe o link de uma planilha do Google" };
  try {
    const { client } = await googleSettingsService.getClient(organizationId);
    const title = await client.getTitle(spreadsheetId);
    return { success: true, message: `Acesso OK à planilha "${title}"` };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
