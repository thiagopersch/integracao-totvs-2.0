import type { UserRoleLevel } from "@/generated/prisma/client";

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: UserRoleLevel;
      organizationId: string;
      permissions: string[];
      allowedClientIds: string[];
      changePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRoleLevel;
    organizationId: string;
    permissions: string[];
    allowedClientIds: string[];
    changePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRoleLevel;
    organizationId: string;
    permissions: string[];
    allowedClientIds: string[];
    changePassword: boolean;
  }
}
