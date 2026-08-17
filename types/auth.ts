import { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: boolean;
  changePassword: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
};

export type AuthSession = {
  user: AuthUser;
  permissions: string[];
};
