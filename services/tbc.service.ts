import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateTbcInput, UpdateTbcInput } from "@/schemas/tbc.schema";
import type { Tbc } from "@prisma/client";

export type TbcRow = Omit<Tbc, "password"> & { hasPassword: boolean; client?: { id: string; name: string } | null };

function stripPassword(tbc: any | null): TbcRow | null {
  if (!tbc) return null;
  const { password, ...rest } = tbc;
  return { ...rest, hasPassword: !!password } as TbcRow;
}

function stripPasswordList(tbcs: any[]): TbcRow[] {
  return tbcs.map((tbc: any) => {
    const { password, ...rest } = tbc;
    return { ...rest, hasPassword: !!password } as TbcRow;
  });
}

class TbcRepository extends BaseRepository<Tbc> {
  constructor() {
    super(prisma.tbc, ["name", "link"], "tbcs");
  }
}

export const tbcRepository = new TbcRepository();

export const tbcService = {
  async list(params: Parameters<typeof tbcRepository.findAll>[0], organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await tbcRepository.buildWhere(params, organizationId);
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : { createdAt: "desc" as const };

    const [tbcs, total] = await Promise.all([
      prisma.tbc.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.tbc.count({ where }),
    ]);

    return {
      data: stripPasswordList(tbcs),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    } as any;
  },

  async listAll(organizationId: string) {
    const tbcs = await prisma.tbc.findMany({
      where: { deletedAt: null, status: true, organizationId },
      orderBy: { name: "asc" },
      include: { client: { select: { id: true, name: true } } },
    });
    return stripPasswordList(tbcs);
  },

  async getById(id: string, organizationId: string) {
    const tbc = await tbcRepository.findById(id, organizationId);
    return stripPassword(tbc);
  },

  async create(input: CreateTbcInput, organizationId: string) {
    const existing = await prisma.tbc.findFirst({ where: { link: input.link, organizationId } });
    if (existing) {
      throw new Error("Link já cadastrado");
    }
    const tbc = await tbcRepository.create({ ...input, organizationId } as any);
    return stripPassword(tbc)!;
  },

  async update(id: string, input: UpdateTbcInput, organizationId: string) {
    if (input.link) {
      const existing = await prisma.tbc.findFirst({
        where: { link: input.link, organizationId, id: { not: id } },
      });
      if (existing) {
        throw new Error("Link já cadastrado");
      }
    }
    const updateData = { ...input };
    if (!updateData.password) {
      delete updateData.password;
    }
    const tbc = await tbcRepository.update(id, updateData as any, organizationId);
    return stripPassword(tbc)!;
  },

  async softDelete(id: string, organizationId: string) {
    const tbc = await tbcRepository.softDelete(id, organizationId);
    return stripPassword(tbc)!;
  },

  async restore(id: string, organizationId: string) {
    const tbc = await tbcRepository.restore(id, organizationId);
    return stripPassword(tbc)!;
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return tbcRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return tbcRepository.bulkRestore(ids, organizationId);
  },
};
