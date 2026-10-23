import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { prisma } from "@/lib/prisma";
import { createSheetsClient, parseServiceAccountKey } from "@/lib/google-sheets";

export interface GoogleSettingsInput {
  /** Omit/empty to keep the stored key (same convention as the SMTP password). */
  serviceAccountJson?: string;
  enabled: boolean;
}

export const googleSettingsService = {
  async get(organizationId: string) {
    return prisma.googleSettings.findUnique({ where: { organizationId } });
  },

  /** Sheets client for the organization's service account, or an error explaining what is missing. */
  async getClient(organizationId: string) {
    const settings = await this.get(organizationId);
    if (!settings) throw new Error("Configure a conta de serviço do Google em Integrações > Planilhas Google");
    if (!settings.enabled) throw new Error("A integração com o Google Sheets está desativada");
    return { client: createSheetsClient(parseServiceAccountKey(decryptSecret(settings.serviceAccountJson))), email: settings.serviceAccountEmail };
  },

  async save(organizationId: string, input: GoogleSettingsInput) {
    const existing = await this.get(organizationId);
    if (!existing && !input.serviceAccountJson) throw new Error("Cole a chave JSON da conta de serviço");
    const key = input.serviceAccountJson ? parseServiceAccountKey(input.serviceAccountJson) : null;
    const keyData = key
      ? { serviceAccountJson: encryptSecret(input.serviceAccountJson!), serviceAccountEmail: key.client_email }
      : {};
    return prisma.googleSettings.upsert({
      where: { organizationId },
      update: { enabled: input.enabled, ...keyData },
      create: { organizationId, enabled: input.enabled, ...(keyData as Required<typeof keyData>) },
    });
  },
};
