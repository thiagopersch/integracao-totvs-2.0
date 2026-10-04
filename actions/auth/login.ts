"use server"

import { AuthError } from "next-auth";
import { signIn, signOut, auth } from "@/auth";
import { authService } from "@/services/auth.service";
import { loginSchema, resetPasswordSchema } from "@/schemas/auth.schema";
import { passwordSchema } from "@/lib/validators";
import { getClientIp } from "@/lib/client-ip";
import { headers } from "next/headers";
import { AUTH_CONFIG } from "@/config/auth.config";
import { checkRateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";
import { getFirstAllowedRoute } from "@/lib/nav-items";

export async function loginAction(formData: FormData) {
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Keyed per source IP + account: one attacker can't lock everybody out (the old fixed
  // "login:internal" key was shared by all users), and authorize() caps attempts per account.
  const ip = getClientIp(await headers());
  const rateCheck = checkRateLimit(
    `login:${ip}:${String(data.email ?? "").toLowerCase()}`,
    AUTH_CONFIG.RATE_LIMIT.LOGIN.window,
    AUTH_CONFIG.RATE_LIMIT.LOGIN.max
  );

  if (!rateCheck.allowed) {
    return { success: false, error: "Muitas tentativas. Tente novamente mais tarde." };
  }

  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Credenciais inválidas" };
    }
    throw error;
  }

  logger.info("User logged in", { email: data.email });

  return { success: true };
}

export async function logoutAction() {
  await signOut({ redirect: false });
  return { success: true };
}

export async function completeForcedPasswordReset(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Sessão inválida" };
  }

  const data = {
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = resetPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  const result = await authService.completeForcedReset(session.user.id, parsed.data.newPassword);
  if (!result.success) return result;

  // Computed server-side against the session already loaded here — the client's useSession()
  // right after the middleware's redirect into this page can still be mid-fetch with no
  // permissions yet, which previously sent everyone to the first resource-less nav item
  // (Rastreamento de Atividades) instead of somewhere meaningful for their role.
  const redirectTo = getFirstAllowedRoute(session.user.permissions || []);
  return { ...result, redirectTo };
}

export async function changePasswordAction(formData: FormData) {
  // The user is always the session's — never an id sent by the client (that allowed guessing and
  // changing any user's password).
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Sessão inválida" };
  }
  const userId = session.user.id;

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  if (!currentPassword || !newPassword) {
    return { success: false, error: "Dados incompletos" };
  }

  const parsed = passwordSchema(true).safeParse(newPassword);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Senha inválida" };
  }

  const { window, max } = AUTH_CONFIG.RATE_LIMIT.CHANGE_PASSWORD;
  if (!checkRateLimit(`change-password:${userId}`, window, max).allowed) {
    return { success: false, error: "Muitas tentativas. Tente novamente mais tarde." };
  }

  return authService.changePassword(userId, currentPassword, parsed.data);
}
