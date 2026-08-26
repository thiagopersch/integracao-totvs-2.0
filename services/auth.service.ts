import { prisma } from "@/lib/prisma";
import { hashPassword, comparePassword } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limiter";
import { notificationService } from "@/services/notification.service";
import { buildLoginSuspiciousNotification } from "@/lib/notification-types";
import type { AuthUser, LoginInput } from "@/types/auth";
import type { User } from "@prisma/client";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_THRESHOLD = 3;

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    organizationId: user.organizationId,
    status: user.status,
    changePassword: user.changePassword,
  };
}

async function loadPermissions(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const keys = new Set<string>();
  for (const userRole of userRoles) {
    for (const rp of userRole.role.rolePermissions) {
      keys.add(`${rp.permission.resource}:${rp.permission.action}`);
    }
  }
  return Array.from(keys);
}

export const authService = {
  async login(input: LoginInput, ip?: string) {
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

      // Reuses the same in-memory limiter as API rate limiting — fires exactly once, on the
      // Nth failure, not on every attempt after (checkRateLimit flips to `allowed: false` past it).
      const attempts = checkRateLimit(`login-fail:${input.email}`, LOGIN_FAILURE_WINDOW_MS, LOGIN_FAILURE_THRESHOLD);
      if (attempts.allowed && attempts.remaining === 0) {
        await notificationService.broadcastToRole(
          user.organizationId,
          "ADMIN",
          buildLoginSuspiciousNotification({ email: input.email, attempts: LOGIN_FAILURE_THRESHOLD })
        );
      }

      return null;
    }

    const permissions = await loadPermissions(user.id);

    logger.info("Login success", { email: input.email, ip });

    return {
      user: toAuthUser(user),
      permissions,
    };
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

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    return comparePassword(password, user.password);
  },

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) return null;
    return toAuthUser(user);
  },
};
