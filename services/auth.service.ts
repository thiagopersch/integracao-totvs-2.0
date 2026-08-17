import { prisma } from "@/lib/prisma";
import { hashPassword, comparePassword } from "@/lib/encryption";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import type { AuthUser, LoginInput } from "@/types/auth";
import type { User } from "@prisma/client";

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    changePassword: user.changePassword,
  };
}

export const authService = {
  async login(input: LoginInput, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || user.deletedAt) {
      logger.warn("Login failed: user not found", { email: input.email, ip });
      return null;
    }

    if (!user.status) {
      logger.warn("Login failed: inactive user", { email: input.email, ip });
      return null;
    }

    const valid = await comparePassword(input.password, user.password);
    if (!valid) {
      logger.warn("Login failed: wrong password", { email: input.email, ip });
      return null;
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    logger.info("Login success", { email: input.email, ip });

    return {
      user: toAuthUser(user),
      accessToken,
      refreshToken,
    };
  },

  async refresh(token: string) {
    try {
      const payload = verifyRefreshToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });

      if (!user || user.deletedAt || !user.status) return null;

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      return {
        accessToken: signAccessToken(newPayload),
        refreshToken: signRefreshToken(newPayload),
        user: toAuthUser(user),
      };
    } catch {
      return null;
    }
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "Usuário não encontrado" };

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) return { success: false, error: "Senha atual incorreta" };

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, changePassword: false },
    });

    return { success: true };
  },

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) return null;
    return toAuthUser(user);
  },
};
