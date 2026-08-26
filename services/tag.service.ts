import { prisma } from "@/lib/prisma";
import { findBlockingReferences, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations";
import type { CreateTagInput, UpdateTagInput } from "@/schemas/tag.schema";
import type { ListParams } from "@/types/common";
import type { BulkDeleteResult } from "@/repositories/base.repository";

export const tagService = {
  async listAll(organizationId: string) {
    return prisma.tag.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  },

  async list(params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = {
      organizationId,
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" as const } } : {}),
    };
    const orderBy = params.sort ? { [params.sort.field]: params.sort.direction } : { name: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.tag.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.tag.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
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
    const reasons = await findBlockingReferences("Tag", id);
    if (reasons.length > 0) {
      throw new Error(`Não é possível excluir: registro em uso em ${formatBlockingReferences(reasons)}.`);
    }
    await prisma.tag.delete({ where: { id } });
  },

  async bulkDelete(ids: string[], organizationId: string): Promise<BulkDeleteResult> {
    const owned = await prisma.tag.findMany({ where: { id: { in: ids }, organizationId }, select: { id: true } });

    const blocked: { id: string; reasons: BlockingReference[] }[] = [];
    const deletableIds: string[] = [];
    for (const tag of owned) {
      const reasons = await findBlockingReferences("Tag", tag.id);
      if (reasons.length > 0) blocked.push({ id: tag.id, reasons });
      else deletableIds.push(tag.id);
    }

    if (deletableIds.length > 0) {
      await prisma.tag.deleteMany({ where: { id: { in: deletableIds } } });
    }
    return { deletedCount: deletableIds.length, deletedIds: deletableIds, blocked };
  },
};
