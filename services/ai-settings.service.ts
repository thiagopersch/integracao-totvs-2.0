import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { prisma } from "@/lib/prisma";
import type { AiClientConfig, AiProviderId } from "@/lib/ai/types";

export interface AiSettingsInput {
  provider: AiProviderId;
  model: string;
  /** Omit/empty to keep the stored key (same convention as the SMTP password). */
  apiKey?: string;
  enabled: boolean;
  instructions: string | null;
}

export const aiSettingsService = {
  async get(organizationId: string) {
    return prisma.aiSettings.findUnique({ where: { organizationId } });
  },

  /** Decrypted config for a call, or null when the assistant isn't configured/enabled. */
  async getClientConfig(organizationId: string): Promise<(AiClientConfig & { instructions: string | null }) | null> {
    const settings = await this.get(organizationId);
    if (!settings || !settings.enabled) return null;
    return { provider: settings.provider, model: settings.model, apiKey: decryptSecret(settings.apiKey), instructions: settings.instructions };
  },

  async save(organizationId: string, input: AiSettingsInput) {
    const existing = await this.get(organizationId);
    // A new provider needs its own key — the stored one belongs to the previous provider.
    if ((!existing || existing.provider !== input.provider) && !input.apiKey) {
      throw new Error("Informe a chave de API do provedor");
    }
    const data = {
      provider: input.provider,
      model: input.model,
      enabled: input.enabled,
      instructions: input.instructions,
    };
    return prisma.aiSettings.upsert({
      where: { organizationId },
      update: { ...data, ...(input.apiKey ? { apiKey: encryptSecret(input.apiKey) } : {}) },
      create: { ...data, organizationId, apiKey: encryptSecret(input.apiKey!) },
    });
  },
};
