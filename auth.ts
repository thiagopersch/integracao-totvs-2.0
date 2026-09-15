import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authService } from "@/services/auth.service";
import { loginSchema } from "@/schemas/auth.schema";
import { AUTH_CONFIG } from "@/config/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: AUTH_CONFIG.SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const result = await authService.login(parsed.data);
        if (!result) return null;

        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          image: result.user.image,
          role: result.user.role,
          organizationId: result.user.organizationId,
          permissions: result.permissions,
          allowedClientIds: result.allowedClientIds,
          changePassword: result.user.changePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.permissions = user.permissions;
        token.allowedClientIds = user.allowedClientIds;
        token.changePassword = user.changePassword;
        return token;
      }

      // Not a fresh sign-in — re-read role/permissions/client access from the DB on every request
      // so an admin editing this user's role, permissions or allowed clients applies immediately,
      // without the affected user having to log out and back in.
      if (token.id) {
        const refreshed = await authService.refreshSession(token.id);
        if (!refreshed) {
          // Usuário/organização não existe mais (deletado, banco trocado) — invalida a sessão em
          // vez de manter um `organizationId` órfão circulando, que só estoura mais tarde como um
          // erro de FK confuso (ex: apiLog.create) em vez de forçar um novo login na hora.
          return null;
        }
        token.role = refreshed.user.role;
        token.organizationId = refreshed.user.organizationId;
        token.permissions = refreshed.permissions;
        token.allowedClientIds = refreshed.allowedClientIds;
        token.changePassword = refreshed.user.changePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.organizationId = token.organizationId;
      session.user.permissions = token.permissions ?? [];
      session.user.allowedClientIds = token.allowedClientIds ?? [];
      session.user.changePassword = token.changePassword;
      return session;
    },
  },
});
