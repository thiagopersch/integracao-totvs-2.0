import { UserRoleLevel } from "@prisma/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRoleLevel;
  organizationId: string;
  status: boolean;
  changePassword: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthSession = {
  user: AuthUser;
  permissions: string[];
};
