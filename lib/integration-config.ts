import type { IntegrationKind } from "@/generated/prisma/client";

/**
 * Timeout/retry policy of each external integration. Defaults come from the environment; an
 * organization can override them in Integrações > Configurações (IntegrationSettings). Reads go
 * through the cached `queries/integration-settings.ts` (tag `integration-settings`).
 */
export type IntegrationConfig = { timeoutMs: number; maxRetries: number; retryDelayMs: number };

export { INTEGRATION_KINDS, INTEGRATION_LABELS, INTEGRATION_LIMITS, RETRYABLE_INTEGRATIONS } from "@/lib/integration-config-shared";
import { INTEGRATION_LIMITS, RETRYABLE_INTEGRATIONS } from "@/lib/integration-config-shared";

export function defaultIntegrationConfig(integration: IntegrationKind): IntegrationConfig {
  switch (integration) {
    case "SOAP":
      // Same variables/defaults as config/app.config.ts — read directly so importing this module (from
      // the mailer, uploads…) doesn't require the whole server env to be valid (tests, scripts).
      return {
        timeoutMs: Number(process.env.SOAP_DEFAULT_TIMEOUT) || 30_000,
        maxRetries: Number(process.env.SOAP_MAX_RETRIES) || 3,
        retryDelayMs: Number(process.env.SOAP_RETRY_DELAY) || 1_000,
      };
    case "SMTP":
      return { timeoutMs: Number(process.env.SMTP_TIMEOUT_MS) || 20_000, maxRetries: 0, retryDelayMs: 0 };
    case "BLOB":
      return { timeoutMs: Number(process.env.BLOB_TIMEOUT_MS) || 60_000, maxRetries: 0, retryDelayMs: 0 };
    default:
      return { timeoutMs: Number(process.env.INTEGRATION_DEFAULT_TIMEOUT_MS) || 30_000, maxRetries: 0, retryDelayMs: 0 };
  }
}

export function clampTimeout(value: number | undefined | null, fallback: number): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), INTEGRATION_LIMITS.timeoutMs.min), INTEGRATION_LIMITS.timeoutMs.max);
}

export function mergeIntegrationConfig(
  integration: IntegrationKind,
  row: { timeoutMs: number; maxRetries: number; retryDelayMs: number } | null | undefined
): IntegrationConfig {
  const defaults = defaultIntegrationConfig(integration);
  if (!row) return defaults;
  return {
    timeoutMs: clampTimeout(row.timeoutMs, defaults.timeoutMs),
    // SOAP counts attempts (≥ 1); the others never retry.
    maxRetries: RETRYABLE_INTEGRATIONS.includes(integration) ? Math.max(1, Math.min(row.maxRetries, INTEGRATION_LIMITS.maxRetries.max)) : 0,
    retryDelayMs: Math.min(Math.max(row.retryDelayMs, 0), INTEGRATION_LIMITS.retryDelayMs.max),
  };
}

/**
 * Effective config for one integration of one organization. Falls back to the defaults if the
 * settings table can't be read (e.g. migration not applied yet) — a timeout setting must never be
 * the reason an integration call fails.
 */
export async function getIntegrationConfig(organizationId: string | null | undefined, integration: IntegrationKind): Promise<IntegrationConfig> {
  if (!organizationId) return defaultIntegrationConfig(integration);
  try {
    const { getIntegrationSettingsMap } = await import("@/queries/integration-settings");
    const rows = await getIntegrationSettingsMap(organizationId);
    return mergeIntegrationConfig(integration, rows[integration]);
  } catch {
    return defaultIntegrationConfig(integration);
  }
}
