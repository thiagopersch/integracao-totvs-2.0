"use server"

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authService } from "@/services/auth.service";
import { loginSchema } from "@/schemas/auth.schema";
import { AUTH_CONFIG } from "@/config/auth.config";
import { checkRateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

export async function loginAction(formData: FormData) {
  const ip = "internal";
  const rateCheck = checkRateLimit(`login:${ip}`, AUTH_CONFIG.RATE_LIMIT.LOGIN.window, AUTH_CONFIG.RATE_LIMIT.LOGIN.max);

  if (!rateCheck.allowed) {
    return { success: false, error: "Muitas tentativas. Tente novamente mais tarde." };
  }

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  const result = await authService.login(parsed.data);
  if (!result) {
    return { success: false, error: "Credenciais inválidas" };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_CONFIG.COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
  cookieStore.set(AUTH_CONFIG.COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  logger.info("User logged in", { email: data.email });

  return { success: true, user: result.user };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_CONFIG.COOKIE_NAMES.ACCESS_TOKEN);
  cookieStore.delete(AUTH_CONFIG.COOKIE_NAMES.REFRESH_TOKEN);
  return { success: true };
}

export async function refreshSessionAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(AUTH_CONFIG.COOKIE_NAMES.REFRESH_TOKEN)?.value;

  if (!refreshToken) return { success: false };

  const result = await authService.refresh(refreshToken);
  if (!result) return { success: false };

  cookieStore.set(AUTH_CONFIG.COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });

  return { success: true, user: result.user };
}

export async function changePasswordAction(formData: FormData) {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const userId = formData.get("userId") as string;

  if (!userId || !currentPassword || !newPassword) {
    return { success: false, error: "Dados incompletos" };
  }

  return authService.changePassword(userId, currentPassword, newPassword);
}
