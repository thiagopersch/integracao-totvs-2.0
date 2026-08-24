"use server"

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
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

export async function changePasswordAction(formData: FormData) {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const userId = formData.get("userId") as string;

  if (!userId || !currentPassword || !newPassword) {
    return { success: false, error: "Dados incompletos" };
  }

  return authService.changePassword(userId, currentPassword, newPassword);
}
