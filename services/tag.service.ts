import { prisma } from "@/lib/prisma";
import type { CreateTagInput, UpdateTagInput } from "@/schemas/tag.schema";

export const tagService = {
  async listAll(organizationId: string) {
    return prisma.tag.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  },

  async list(organizationId: string, search?: string) {
    return prisma.tag.findMany({
      where: { organizationId, ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
      orderBy: { name: "asc" },
    });
  },

  async create(input: CreateTagInput, organizationId: string) {
    const existing = await prisma.tag.findFirst({ where: { name: input.name, organizationId } });
    if (existing) throw new Error("Já existe uma tag com este nome");
    return prisma.tag.create({ data: { ...input, organizationId } });
  },

  async update(id: string, input: UpdateTagInput, organizationId: string) {
    if (input.name) {
      const existing = await prisma.tag.findFirst({ where: { name: input.name, organizationId, id: { not: id } } });
      if (existing) throw new Error("Já existe uma tag com este nome");
    }
    return prisma.tag.update({ where: { id, organizationId }, data: input });
  },

  async remove(id: string, organizationId: string) {
    const tag = await prisma.tag.findFirst({ where: { id, organizationId } });
    if (!tag) throw new Error("Tag não encontrada");
    await prisma.tag.delete({ where: { id } });
  },
};
