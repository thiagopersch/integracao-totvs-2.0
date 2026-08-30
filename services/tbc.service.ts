import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import { assertClientAllowed } from "@/lib/client-access";
import type { CreateTbcInput, UpdateTbcInput } from "@/schemas/tbc.schema";
import type { PaginationMeta } from "@/types/common";
import type { TbcCredentials } from "@/services/soap.service";
import type { Tbc } from "@/generated/prisma/client";

export type TbcRow = Omit<Tbc, "password"> & { hasPassword: boolean; client?: { id: string; name: string } | null };
type TbcWithMaybeClient = Tbc & { client?: { id: string; name: string } | null };

function stripPassword<TIn extends TbcWithMaybeClient | null>(tbc: TIn): TbcRow | null {
  if (!tbc) return null;
  const { password, ...rest } = tbc;
  return { ...rest, hasPassword: !!password };
}

function stripPasswordList(tbcs: TbcWithMaybeClient[]): TbcRow[] {
  return tbcs.map((tbc) => {
    const { password, ...rest } = tbc;
    return { ...rest, hasPassword: !!password };
  });
}

class TbcRepository extends BaseRepository<Tbc> {
  constructor() {
    super(prisma.tbc, ["name", "link"], "tbcs", "Tbc");
  }
}

export const tbcRepository = new TbcRepository();

export const tbcService = {
  async list(params: Parameters<typeof tbcRepository.findAll>[0], organizationId: string, allowedClientIds: string[]) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = await tbcRepository.buildWhere(params, organizationId);
    where.clientId = { in: allowedClientIds };
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : [{ client: { favorite: "desc" as const } }, { client: { name: "asc" as const } }, { name: "asc" as const }];

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
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } satisfies PaginationMeta,
    };
  },

  async listAll(organizationId: string, allowedClientIds: string[]) {
    const tbcs = await prisma.tbc.findMany({
      where: { deletedAt: null, status: true, organizationId, clientId: { in: allowedClientIds } },
      orderBy: { name: "asc" },
      include: { client: { select: { id: true, name: true } } },
    });
    return stripPasswordList(tbcs);
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]) {
    const tbc = await tbcRepository.findById(id, organizationId, { clientId: { in: allowedClientIds } });
    return stripPassword(tbc);
  },

  async create(input: CreateTbcInput, organizationId: string, allowedClientIds: string[]) {
    assertClientAllowed(input.clientId, allowedClientIds);
    const existing = await prisma.tbc.findFirst({ where: { link: input.link, organizationId } });
    if (existing) {
      throw new Error("Link já cadastrado");
    }
    const tbc = await tbcRepository.create({ ...input, organizationId });
    return stripPassword(tbc)!;
  },

  async update(id: string, input: UpdateTbcInput, organizationId: string, allowedClientIds: string[]) {
    if (input.clientId) assertClientAllowed(input.clientId, allowedClientIds);
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
    const tbc = await tbcRepository.update(id, updateData, organizationId, { clientId: { in: allowedClientIds } });
    return stripPassword(tbc)!;
  },

  async softDelete(id: string, organizationId: string, allowedClientIds: string[]) {
    const tbc = await tbcRepository.softDelete(id, organizationId, { clientId: { in: allowedClientIds } });
    return stripPassword(tbc)!;
  },

  async setStatus(id: string, status: boolean, organizationId: string, allowedClientIds: string[]) {
    const tbc = await tbcRepository.setStatus(id, status, organizationId, { clientId: { in: allowedClientIds } });
    return stripPassword(tbc)!;
  },

  async restore(id: string, organizationId: string, allowedClientIds: string[]) {
    const tbc = await tbcRepository.restore(id, organizationId, { clientId: { in: allowedClientIds } });
    return stripPassword(tbc)!;
  },

  async bulkSoftDelete(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return tbcRepository.bulkSoftDelete(ids, organizationId, { clientId: { in: allowedClientIds } });
  },

  async bulkRestore(ids: string[], organizationId: string, allowedClientIds: string[]) {
    return tbcRepository.bulkRestore(ids, organizationId, { clientId: { in: allowedClientIds } });
  },

  /**
   * Every TOTVS request (Report/Fórmula Visual/Dataserver/Processo/Consulta SQL) must be
   * anchored to an active TBC and read its "não consumir licença" flag before dispatching —
   * this is the single place that enforces that and hands back live SOAP credentials. Also the
   * single choke point for client-access enforcement across every SOAP/TOTVS entry point.
   */
  async getCredentialsForRequest(id: string, organizationId: string, allowedClientIds: string[]): Promise<TbcCredentials> {
    const tbc = await prisma.tbc.findFirst({
      where: { id, organizationId, deletedAt: null, clientId: { in: allowedClientIds } },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!tbc) {
      throw new Error("TBC não encontrado. Cadastre e selecione um TBC válido antes de executar a requisição.");
    }
    if (!tbc.status) {
      throw new Error(`TBC "${tbc.name}" está inativo. Ative o TBC antes de executar requisições no TOTVS.`);
    }
    return {
      id: tbc.id,
      name: tbc.name,
      link: tbc.link,
      user: tbc.user,
      password: tbc.password,
      notRequiredLicense: tbc.notRequiredLicense,
      clientId: tbc.client.id,
      clientName: tbc.client.name,
    };
  },
};
