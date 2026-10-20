import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/schemas/department.schema";
import type { Department, Prisma } from "@/generated/prisma/client";
import type { SortParams } from "@/types/common";

const listInclude = {
  client: { select: { id: true, name: true, color: true } },
  departmentRequesters: { select: { requester: { select: { id: true, name: true, color: true } } } },
} satisfies Prisma.DepartmentInclude;

export type DepartmentWithLinks = Prisma.DepartmentGetPayload<{ include: typeof listInclude }>;

/** Department as used by the demand form cascade: the requesters linked to it. */
export type DepartmentOption = Department & { requesterIds: string[] };

class DepartmentRepository extends BaseRepository<Department> {
  constructor() {
    super(prisma.department, ["name", "description"], "departments", "Department");
  }

  protected override orderByFor(sort: SortParams) {
    if (sort.field === "client") return { client: { name: sort.direction } };
    return super.orderByFor(sort);
  }

  protected override listInclude() {
    return listInclude;
  }

  // Its requester links are part of the department itself, never a reason to block deleting it.
  protected override ownedModels() {
    return ["DepartmentRequester"];
  }
}

export const departmentRepository = new DepartmentRepository();

/** The client must be in the organization and every requester must belong to that client. */
async function assertLinks(input: { clientId: string; requesterIds: string[] }, organizationId: string) {
  const client = await prisma.client.findFirst({ where: { id: input.clientId, organizationId, deletedAt: null }, select: { id: true } });
  if (!client) throw new Error("Cliente não encontrado");
  const requesterIds = [...new Set(input.requesterIds)];
  const count = await prisma.requester.count({
    where: { id: { in: requesterIds }, organizationId, clientId: input.clientId, deletedAt: null },
  });
  if (count !== requesterIds.length) throw new Error("Há solicitantes que não pertencem ao cliente selecionado");
  return requesterIds;
}

export const departmentService = {
  async list(params: Parameters<typeof departmentRepository.findAll>[0], organizationId: string) {
    return departmentRepository.findAll(params, organizationId) as Promise<{
      data: DepartmentWithLinks[];
      meta: Awaited<ReturnType<typeof departmentRepository.findAll>>["meta"];
    }>;
  },

  async listAll(organizationId: string): Promise<DepartmentOption[]> {
    const rows = await prisma.department.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
      include: { departmentRequesters: { select: { requesterId: true } } },
    });
    return rows.map(({ departmentRequesters, ...d }) => ({ ...d, requesterIds: departmentRequesters.map((r) => r.requesterId) }));
  },

  async getById(id: string, organizationId: string) {
    return departmentRepository.findById(id, organizationId);
  },

  async create(input: CreateDepartmentInput, organizationId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { requesterIds: _ids, ...data } = input;
    const requesterIds = await assertLinks(input, organizationId);
    return prisma.department.create({
      data: { ...data, organizationId, departmentRequesters: { create: requesterIds.map((requesterId) => ({ requesterId })) } },
    });
  },

  async update(id: string, input: UpdateDepartmentInput, organizationId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { requesterIds: _ids, ...data } = input;
    const requesterIds = await assertLinks(input, organizationId);
    const current = await departmentRepository.findById(id, organizationId);
    if (!current) throw new Error("Departamento não encontrado");
    return prisma.department.update({
      where: { id, organizationId },
      data: {
        ...data,
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
