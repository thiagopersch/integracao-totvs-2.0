import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/encryption";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/user.schema";
import type { User } from "@/generated/prisma/client";

class UserRepository extends BaseRepository<User> {
  constructor() {
    super(prisma.user, ["name", "email"], "users", "User");
  }
}

export const userRepository = new UserRepository();

export const userService = {
  async list(params: Parameters<typeof userRepository.findAll>[0], organizationId: string) {
    return userRepository.findAll(params, organizationId);
  },

  /** Groups the assigned clients per user, for annotating a list of users with their access scope. */
  async getAllowedClientsForUsers(userIds: string[]) {
    if (userIds.length === 0) return {} as Record<string, { id: string; name: string }[]>;
    const rows = await prisma.userClient.findMany({
      where: { userId: { in: userIds } },
      include: { client: { select: { id: true, name: true } } },
    });
    const map: Record<string, { id: string; name: string }[]> = {};
    for (const row of rows) {
      (map[row.userId] ??= []).push(row.client);
    }
    return map;
  },

  async getAllowedClientIds(userId: string) {
    const rows = await prisma.userClient.findMany({ where: { userId }, select: { clientId: true } });
    return rows.map((r) => r.clientId);
  },

  async setAllowedClients(userId: string, clientIds: string[], organizationId: string) {
    const validClients = await prisma.client.findMany({
      where: { id: { in: clientIds }, organizationId },
      select: { id: true },
    });
    const validIds = validClients.map((c) => c.id);

    await prisma.$transaction([
      prisma.userClient.deleteMany({ where: { userId } }),
      prisma.userClient.createMany({ data: validIds.map((clientId) => ({ userId, clientId })) }),
    ]);
    return validIds;
  },

  async getById(id: string, organizationId: string) {
    return userRepository.findById(id, organizationId);
  },

  async create(input: CreateUserInput, organizationId: string) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new Error("E-mail já cadastrado");
    }
    const hashedPassword = await hashPassword(input.password);
    return userRepository.create({
      ...input,
      organizationId,
      password: hashedPassword,
    });
  },

  async update(id: string, input: UpdateUserInput, organizationId: string) {
    if (input.email) {
      const existing = await prisma.user.findFirst({
        where: { email: input.email, id: { not: id } },
      });
      if (existing) {
        throw new Error("E-mail já cadastrado");
      }
    }
    return userRepository.update(id, input, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return userRepository.softDelete(id, organizationId);
  },

  async setStatus(id: string, status: boolean, organizationId: string) {
    return userRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return userRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return userRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return userRepository.bulkRestore(ids, organizationId);
  },

  /** Admin-initiated reset: sets a temporary password and forces the user to pick a new one at next login. */
  async resetPassword(id: string, temporaryPassword: string, organizationId: string) {
    const hashedPassword = await hashPassword(temporaryPassword);
    return userRepository.update(id, { password: hashedPassword, changePassword: true }, organizationId);
  },
};
