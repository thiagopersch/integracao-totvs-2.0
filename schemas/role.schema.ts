import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).default([]),
});

export type CreateRoleInput = z.output<typeof createRoleSchema>;
export type UpdateRoleInput = z.output<typeof updateRoleSchema>;
