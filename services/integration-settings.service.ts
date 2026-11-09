import { prisma } from "@/lib/prisma";
import { INTEGRATION_KINDS, defaultIntegrationConfig, mergeIntegrationConfig, type IntegrationConfig } from "@/lib/integration-config";
import type { IntegrationKind } from "@/generated/prisma/client";

export type IntegrationSettingsRow = IntegrationConfig & { integration: IntegrationKind; customized: boolean; defaults: IntegrationConfig };

export const integrationSettingsService = {
  async list(organizationId: string): Promise<IntegrationSettingsRow[]> {
    const rows = await prisma.integrationSettings.findMany({ where: { organizationId } });
    const byKind = new Map(rows.map((r) => [r.integration, r]));
    return INTEGRATION_KINDS.map((integration) => {
      const row = byKind.get(integration);
      return { integration, customized: !!row, defaults: defaultIntegrationConfig(integration), ...mergeIntegrationConfig(integration, row) };
    });
  },

  async save(organizationId: string, integration: IntegrationKind, config: IntegrationConfig) {
    return prisma.integrationSettings.upsert({
      where: { organizationId_integration: { organizationId, integration } },
      update: config,
      create: { organizationId, integration, ...config },
    });
  },

  async reset(organizationId: string, integration: IntegrationKind) {
    await prisma.integrationSettings.deleteMany({ where: { organizationId, integration } });
  },
};
