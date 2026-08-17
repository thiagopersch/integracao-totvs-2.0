import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const result = await authService.refresh(refreshToken);
    if (!result) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set("access_token", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });
    response.cookies.set("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
