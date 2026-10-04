import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authService } from "@/services/auth.service";
import { loginSchema } from "@/schemas/auth.schema";
import { AUTH_CONFIG } from "@/config/auth.config";
import { checkRateLimit } from "@/lib/rate-limiter";

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

        // Enforced here too (not only in loginAction): /api/auth/callback/credentials can be posted to
        // directly, bypassing the Server Action.
        const { window, max } = AUTH_CONFIG.RATE_LIMIT.LOGIN_PER_ACCOUNT;
        if (!checkRateLimit(`login-account:${parsed.data.email.toLowerCase()}`, window, max).allowed) return null;

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
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.permissions = user.permissions;
        token.allowedClientIds = user.allowedClientIds;
        token.changePassword = user.changePassword;
        token.authAt = Date.now();
        token.refreshedAt = Date.now();
        return token;
      }

      if (token.id) {
        // Re-read role/permissions/client access from the DB at most once per interval (not on every
        // request — that was ~6 queries per request, prefetches included). Admin changes apply
        // within the interval; `update()` from the client forces it immediately.
        const fresh = Date.now() - (token.refreshedAt ?? 0) < AUTH_CONFIG.SESSION_REFRESH_INTERVAL_MS;
        if (fresh && trigger !== "update") return token;

        // Tokens issued before `authAt` existed: fall back to their issue time.
        token.authAt ??= typeof token.iat === "number" ? token.iat * 1000 : Date.now();
        const refreshed = await authService.refreshSession(token.id, token.authAt);
        if (!refreshed) {
          // Usuário deletado/desativado, organização inexistente, ou senha trocada/resetada depois
          // deste login — invalida a sessão em vez de manter um `organizationId` órfão ou uma sessão
          // antiga circulando.
          return null;
        }
        token.role = refreshed.user.role;
        token.organizationId = refreshed.user.organizationId;
        token.permissions = refreshed.permissions;
        token.allowedClientIds = refreshed.allowedClientIds;
        token.changePassword = refreshed.user.changePassword;
        token.refreshedAt = Date.now();
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
