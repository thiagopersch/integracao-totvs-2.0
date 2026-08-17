import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/encryption";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/user.schema";
import type { User } from "@prisma/client";

class UserRepository extends BaseRepository<User> {
  constructor() {
    super(prisma.user, ["name", "email"]);
  }
}

export const userRepository = new UserRepository();

export const userService = {
  async list(params: Parameters<typeof userRepository.findAll>[0]) {
    return userRepository.findAll(params);
  },

  async getById(id: string) {
    return userRepository.findById(id);
  },

  async create(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new Error("E-mail já cadastrado");
    }
    const hashedPassword = await hashPassword(input.password);
    return userRepository.create({
      ...input,
      password: hashedPassword,
    } as any);
  },

  async update(id: string, input: UpdateUserInput) {
    if (input.email) {
      const existing = await prisma.user.findFirst({
        where: { email: input.email, id: { not: id } },
      });
      if (existing) {
        throw new Error("E-mail já cadastrado");
      }
    }
    return userRepository.update(id, input as any);
  },

  async softDelete(id: string) {
    return userRepository.softDelete(id);
  },

  async restore(id: string) {
    return userRepository.restore(id);
  },

  async bulkSoftDelete(ids: string[]) {
    return userRepository.bulkSoftDelete(ids);
  },

  async bulkRestore(ids: string[]) {
    return userRepository.bulkRestore(ids);
  },
};
