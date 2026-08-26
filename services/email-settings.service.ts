import { prisma } from "@/lib/prisma";

export interface EmailSettingsInput {
  host: string;
  port: number;
  user: string;
  /** Omit/empty to keep the currently stored password unchanged (same convention as Tbc's edit form). */
  password?: string;
  from: string;
  enabled: boolean;
}

export const emailSettingsService = {
  async get(organizationId: string) {
    return prisma.emailSettings.findUnique({ where: { organizationId } });
  },

  async save(organizationId: string, input: EmailSettingsInput) {
    const existing = await prisma.emailSettings.findUnique({ where: { organizationId } });
    if (!existing && !input.password) {
      throw new Error("Senha é obrigatória");
    }

    return prisma.emailSettings.upsert({
      where: { organizationId },
      update: {
        host: input.host,
        port: input.port,
        user: input.user,
        from: input.from,
        enabled: input.enabled,
        ...(input.password ? { password: input.password } : {}),
      },
      create: {
        organizationId,
        host: input.host,
        port: input.port,
        user: input.user,
        password: input.password!,
        from: input.from,
        enabled: input.enabled,
      },
    });
  },
};
