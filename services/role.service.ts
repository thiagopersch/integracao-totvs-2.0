import { prisma } from "@/lib/prisma";
import type { CreateRoleInput, UpdateRoleInput } from "@/schemas/role.schema";
import { RESOURCE_LABELS } from "@/config/permissions";

export const roleService = {
  async list(organizationId: string) {
    return prisma.role.findMany({
      where: { organizationId },
      include: { rolePermissions: true, userRoles: true },
      orderBy: { name: "asc" },
    });
  },

  async getById(id: string, organizationId: string) {
    return prisma.role.findFirst({
      where: { id, organizationId },
      include: { rolePermissions: { include: { permission: true } } },
    });
  },

  async listAllPermissions() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { resource: "asc" }, { action: "asc" }],
    });
    return permissions.map((p) => ({ ...p, resourceLabel: RESOURCE_LABELS[p.resource] || p.resource }));
  },

  async create(input: CreateRoleInput, organizationId: string) {
    const existing = await prisma.role.findFirst({ where: { name: input.name, organizationId } });
    if (existing) {
      throw new Error("Já existe um papel com este nome");
    }
    return prisma.role.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        rolePermissions: { create: input.permissionIds.map((permissionId) => ({ permissionId })) },
      },
    });
  },

  async update(id: string, input: UpdateRoleInput, organizationId: string) {
    const role = await prisma.role.findFirst({ where: { id, organizationId } });
    if (!role) throw new Error("Papel não encontrado");

    if (input.name) {
      const existing = await prisma.role.findFirst({ where: { name: input.name, organizationId, id: { not: id } } });
      if (existing) throw new Error("Já existe um papel com este nome");
    }

    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return prisma.role.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        rolePermissions: { create: input.permissionIds.map((permissionId) => ({ permissionId })) },
      },
    });
  },

  async remove(id: string, organizationId: string) {
    const role = await prisma.role.findFirst({ where: { id, organizationId } });
    if (!role) throw new Error("Papel não encontrado");
    if (role.isSystem) throw new Error("Papéis do sistema não podem ser excluídos");

    const inUse = await prisma.userRole.count({ where: { roleId: id } });
    if (inUse > 0) throw new Error("Não é possível excluir um papel atribuído a usuários");

    await prisma.role.delete({ where: { id } });
  },
};
