"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { auditService } from "@/services/audit.service";
import { integrationSettingsService } from "@/services/integration-settings.service";
import { INTEGRATION_KINDS, INTEGRATION_LIMITS, RETRYABLE_INTEGRATIONS } from "@/lib/integration-config";

const { timeoutMs, maxRetries, retryDelayMs } = INTEGRATION_LIMITS;

const saveSchema = z.object({
  integration: z.enum(INTEGRATION_KINDS),
  timeoutSeconds: z.coerce
    .number({ message: "Informe o tempo limite" })
    .min(timeoutMs.min / 1000, `Tempo limite mínimo de ${timeoutMs.min / 1000} s`)
    .max(timeoutMs.max / 1000, `Tempo limite máximo de ${timeoutMs.max / 1000} s`),
  maxRetries: z.coerce.number().int().min(maxRetries.min).max(maxRetries.max).default(0),
  retryDelaySeconds: z.coerce.number().min(retryDelayMs.min / 1000).max(retryDelayMs.max / 1000).default(1),
});

export async function getIntegrationSettings() {
  const { organizationId } = await requirePermission("settings", "manage");
  return integrationSettingsService.list(organizationId);
}

export async function saveIntegrationSettings(input: z.input<typeof saveSchema>) {
  const { organizationId } = await requirePermission("settings", "manage");
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { integration, timeoutSeconds, retryDelaySeconds } = parsed.data;
  const retryable = RETRYABLE_INTEGRATIONS.includes(integration);
  try {
    const config = {
      timeoutMs: Math.round(timeoutSeconds * 1000),
      maxRetries: retryable ? Math.max(1, parsed.data.maxRetries) : 0,
      retryDelayMs: retryable ? Math.round(retryDelaySeconds * 1000) : 0,
    };
    await integrationSettingsService.save(organizationId, integration, config);
    await auditService.log({ action: "UPDATE", entity: "IntegrationSettings", entityId: integration, newData: config });
    updateTag(`integration-settings:${organizationId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

export async function resetIntegrationSettings(integration: string) {
  const { organizationId } = await requirePermission("settings", "manage");
  const parsed = z.enum(INTEGRATION_KINDS).safeParse(integration);
  if (!parsed.success) return { success: false as const, error: "Integração inválida" };
  try {
    await integrationSettingsService.reset(organizationId, parsed.data);
    await auditService.log({ action: "UPDATE", entity: "IntegrationSettings", entityId: parsed.data, newData: { reset: true } });
    updateTag(`integration-settings:${organizationId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
