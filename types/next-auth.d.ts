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
    /** Sign-in time (ms) — sessions older than the user's last password change are rejected. */
    authAt?: number;
    /** Last time role/permissions were re-read from the DB (ms). */
    refreshedAt?: number;
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
    /** Sign-in time (ms) — sessions older than the user's last password change are rejected. */
    authAt?: number;
    /** Last time role/permissions were re-read from the DB (ms). */
    refreshedAt?: number;
  }
}
