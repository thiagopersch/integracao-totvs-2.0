"use server";

import { cookies } from "next/headers";
import { PERIOD_COOKIE_NAME, type Period } from "@/lib/period";

export async function setPeriodCookie(period: Period | null) {
  const cookieStore = await cookies();
  if (!period) {
    cookieStore.delete(PERIOD_COOKIE_NAME);
    return;
  }
  cookieStore.set(PERIOD_COOKIE_NAME, JSON.stringify(period), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
