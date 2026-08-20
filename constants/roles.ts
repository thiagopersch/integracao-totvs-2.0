import { UserRoleLevel } from "@prisma/client";

export const ROLES = {
  ADMIN: UserRoleLevel.ADMIN,
  MANAGER: UserRoleLevel.MANAGER,
  USER: UserRoleLevel.USER,
} as const;

export const ROLE_LABELS: Record<UserRoleLevel, string> = {
  [UserRoleLevel.ADMIN]: "Administrador",
  [UserRoleLevel.MANAGER]: "Gerente",
  [UserRoleLevel.USER]: "Usuário",
};

export const ROLE_HIERARCHY: Record<UserRoleLevel, number> = {
  [UserRoleLevel.ADMIN]: 3,
  [UserRoleLevel.MANAGER]: 2,
  [UserRoleLevel.USER]: 1,
};
