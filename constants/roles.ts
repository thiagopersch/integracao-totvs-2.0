import { Role } from "@prisma/client";

export const ROLES = {
  ADMIN: Role.ADMIN,
  MANAGER: Role.MANAGER,
  USER: Role.USER,
} as const;

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: "Administrador",
  [Role.MANAGER]: "Gerente",
  [Role.USER]: "Usuário",
};

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.ADMIN]: 3,
  [Role.MANAGER]: 2,
  [Role.USER]: 1,
};
