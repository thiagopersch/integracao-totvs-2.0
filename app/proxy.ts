import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken, type JwtPayload } from "@/lib/jwt";
import { AUTH_CONFIG } from "@/config/auth.config";
import { ROLE_PERMISSIONS } from "@/config/permissions";
import { checkRateLimit } from "@/lib/rate-limiter";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/api/auth/login", "/api/auth/refresh"];

const ADMIN_PREFIXES = ["/admin", "/api/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rateCheck = checkRateLimit(`api:${ip}`);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const accessToken = request.cookies.get(AUTH_CONFIG.COOKIE_NAMES.ACCESS_TOKEN)?.value;

  if (!accessToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(accessToken);
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (payload.role !== "ADMIN" && payload.role !== "MANAGER") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-permissions", JSON.stringify(ROLE_PERMISSIONS[payload.role as keyof typeof ROLE_PERMISSIONS] || []));

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
