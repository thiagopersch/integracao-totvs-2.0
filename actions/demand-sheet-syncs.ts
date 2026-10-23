"use server"

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { assertClientListScope } from "@/lib/client-scope";
import { hasPermission } from "@/lib/permissions";
import { auditService } from "@/services/audit.service";
import { demandSheetSyncService } from "@/services/demand-sheet-sync.service";
import { googleSettingsService } from "@/services/google-settings.service";
import { demandSheetSyncSchema } from "@/schemas/demand-sheet-sync.schema";

function parse(input: unknown) {
  const parsed = demandSheetSyncSchema.safeParse(input);
  return parsed.success
    ? { data: parsed.data, error: null }
    : { data: null, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
}

export async function getSheetSyncsPageData() {
  const ctx = await requirePermission("sheet_syncs", "read");
  const [syncs, clients, analysts, settings] = await Promise.all([
    demandSheetSyncService.list(ctx.organizationId),
    prisma.client.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null, id: { in: ctx.allowedClientIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.analyst.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null, status: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    googleSettingsService.get(ctx.organizationId),
  ]);
  return {
    syncs,
    clients,
    analysts,
    // Everyone who sees the page needs the e-mail to share the spreadsheet with; the key never leaves the server.
    google: settings ? { serviceAccountEmail: settings.serviceAccountEmail, enabled: settings.enabled } : null,
    canManageGoogle: hasPermission(ctx.permissions, "integrations", "execute"),
  };
}

export async function createSheetSync(input: unknown) {
  const ctx = await requirePermission("sheet_syncs", "create");
  const { data, error } = parse(input);
  if (!data) return { success: false, error };
  try {
    await assertClientListScope(data.clientIds, ctx);
    const entity = await demandSheetSyncService.create(data, ctx.organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "DemandSheetSync",
      entityId: entity.id,
      newData: { name: entity.name, spreadsheetId: entity.spreadsheetId, schedule: entity.schedule },
    });
    return { success: true, id: entity.id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updateSheetSync(id: string, input: unknown) {
  const ctx = await requirePermission("sheet_syncs", "update");
  const { data, error } = parse(input);
  if (!data) return { success: false, error };
  try {
    await assertClientListScope(data.clientIds, ctx);
    const entity = await demandSheetSyncService.update(id, data, ctx.organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "DemandSheetSync",
      entityId: id,
      newData: { name: entity.name, spreadsheetId: entity.spreadsheetId, schedule: entity.schedule },
    });
    return { success: true, id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function setSheetSyncActive(id: string, isActive: boolean) {
  const ctx = await requirePermission("sheet_syncs", "update");
  try {
    const entity = await demandSheetSyncService.setActive(id, isActive, ctx.organizationId);
    await auditService.log({
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entity: "DemandSheetSync",
      entityId: id,
      newData: { name: entity.name },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteSheetSync(id: string) {
  const ctx = await requirePermission("sheet_syncs", "delete");
  try {
    await demandSheetSyncService.remove(id, ctx.organizationId);
    await auditService.log({ action: "DELETE", entity: "DemandSheetSync", entityId: id });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function runSheetSyncNow(id: string) {
  const ctx = await requirePermission("sheet_syncs", "execute");
  try {
    const result = await demandSheetSyncService.run(id, ctx.organizationId, { trigger: "manual", userId: ctx.userId });
    return { success: result.status === "SUCCESS", ...result };
  } catch (e) {
    return { success: false, status: "FAILED" as const, message: (e as Error).message };
  }
}
