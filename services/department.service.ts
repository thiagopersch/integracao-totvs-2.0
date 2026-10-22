import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/schemas/department.schema";
import type { Department, Prisma } from "@/generated/prisma/client";

const listInclude = {
  departmentClients: { select: { client: { select: { id: true, name: true, color: true } } }, orderBy: { client: { name: "asc" } } },
  departmentRequesters: { select: { requester: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.DepartmentInclude;

export type DepartmentWithLinks = Prisma.DepartmentGetPayload<{ include: typeof listInclude }>;

/** Department as used by the demand form cascade: the clients it applies to and the requesters linked to it. */
export type DepartmentOption = Department & { clientIds: string[]; requesterIds: string[] };

class DepartmentRepository extends BaseRepository<Department> {
  constructor() {
    super(prisma.department, ["name", "description"], "departments", "Department");
  }

  protected override listInclude() {
    return listInclude;
  }

  // Its client/requester links are part of the department itself, never a reason to block deleting it.
  protected override ownedModels() {
    return ["DepartmentClient", "DepartmentRequester"];
  }
}

export const departmentRepository = new DepartmentRepository();

/** Every client must be in the organization and every requester must belong to one of those clients. */
async function assertLinks(input: { clientIds: string[]; requesterIds: string[] }, organizationId: string) {
  const clientIds = [...new Set(input.clientIds)];
  const clientCount = await prisma.client.count({ where: { id: { in: clientIds }, organizationId, deletedAt: null } });
  if (clientCount !== clientIds.length) throw new Error("Cliente não encontrado");
  const requesterIds = [...new Set(input.requesterIds)];
  const count = await prisma.requester.count({
    where: { id: { in: requesterIds }, organizationId, clientId: { in: clientIds }, deletedAt: null },
  });
  if (count !== requesterIds.length) throw new Error("Há solicitantes que não pertencem aos clientes selecionados");
  return { clientIds, requesterIds };
}

export const departmentService = {
  /** `clientIds` narrows to departments that apply to any of those clients. */
  async list(params: Parameters<typeof departmentRepository.findAll>[0], organizationId: string, clientIds: string[] = []) {
    const extraWhere = clientIds.length ? { departmentClients: { some: { clientId: { in: clientIds } } } } : undefined;
    return departmentRepository.findAll(params, organizationId, extraWhere) as Promise<{
      data: DepartmentWithLinks[];
      meta: Awaited<ReturnType<typeof departmentRepository.findAll>>["meta"];
    }>;
  },

  async listAll(organizationId: string): Promise<DepartmentOption[]> {
    const rows = await prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { departmentClients: { select: { clientId: true } }, departmentRequesters: { select: { requesterId: true } } },
    });
    return rows.map(({ departmentClients, departmentRequesters, ...d }) => ({
      ...d,
      clientIds: departmentClients.map((c) => c.clientId),
      requesterIds: departmentRequesters.map((r) => r.requesterId),
    }));
  },

  async getById(id: string, organizationId: string) {
    return departmentRepository.findById(id, organizationId);
  },

  async create(input: CreateDepartmentInput, organizationId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientIds: _clientIds, requesterIds: _ids, ...data } = input;
    const { clientIds, requesterIds } = await assertLinks(input, organizationId);
    return prisma.department.create({
      data: {
        ...data,
        organizationId,
        departmentClients: { create: clientIds.map((clientId) => ({ clientId })) },
        departmentRequesters: { create: requesterIds.map((requesterId) => ({ requesterId })) },
      },
    });
  },

  async update(id: string, input: UpdateDepartmentInput, organizationId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientIds: _clientIds, requesterIds: _ids, ...data } = input;
    const { clientIds, requesterIds } = await assertLinks(input, organizationId);
    const current = await departmentRepository.findById(id, organizationId);
    if (!current) throw new Error("Departamento não encontrado");
    return prisma.department.update({
      where: { id, organizationId },
      data: {
        ...data,
        departmentClients: { deleteMany: {}, create: clientIds.map((clientId) => ({ clientId })) },
        departmentRequesters: { deleteMany: {}, create: requesterIds.map((requesterId) => ({ requesterId })) },
      },
    });
  },

  async softDelete(id: string, organizationId: string) {
    return departmentRepository.softDelete(id, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return departmentRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    return departmentRepository.bulkSoftDelete(ids, organizationId);
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return departmentRepository.bulkRestore(ids, organizationId);
  },
};
