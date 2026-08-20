import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/encryption";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/user.schema";
import type { User } from "@prisma/client";

class UserRepository extends BaseRepository<User> {
  constructor() {
    super(prisma.user, ["name", "email"], "users");
  }
}

export const userRepository = new UserRepository();

export const userService = {
  async list(params: Parameters<typeof userRepository.findAll>[0], organizationId: string) {
    return userRepository.findAll(params, organizationId);
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
    } as any);
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
    return userRepository.update(id, input as any, organizationId);
  },

  async softDelete(id: string, organizationId: string) {
    return userRepository.softDelete(id, organizationId);
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
};
