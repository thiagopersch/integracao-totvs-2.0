import { prisma } from "@/lib/prisma";
import { BaseRepository } from "@/repositories/base.repository";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "@/schemas/department.schema";
import type { Department } from "@prisma/client";

class DepartmentRepository extends BaseRepository<Department> {
  constructor() {
    super(prisma.department, ["name", "description"], "departments", "Department");
  }
}

export const departmentRepository = new DepartmentRepository();

export const departmentService = {
  async list(params: Parameters<typeof departmentRepository.findAll>[0], organizationId: string) {
    return departmentRepository.findAll(params, organizationId);
  },

  async listAll(organizationId: string) {
    return departmentRepository.listAll(organizationId);
  },

  async getById(id: string, organizationId: string) {
    return departmentRepository.findById(id, organizationId);
  },

  async create(input: CreateDepartmentInput, organizationId: string) {
    return departmentRepository.create({ ...input, organizationId });
  },

  async update(id: string, input: UpdateDepartmentInput, organizationId: string) {
    return departmentRepository.update(id, input, organizationId);
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
