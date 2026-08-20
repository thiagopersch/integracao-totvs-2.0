import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken, type JwtPayload } from "@/lib/jwt";
import { AUTH_CONFIG } from "@/config/auth.config";
import { hasPermission } from "@/lib/permissions";
import { findNavItemByPathname } from "@/lib/nav-items";
import { checkRateLimit } from "@/lib/rate-limiter";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/api/auth/login", "/api/auth/refresh"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rateCheck = checkRateLimit(`api:${ip}`);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const accessToken = request.cookies.get(AUTH_CONFIG.COOKIE_NAMES.ACCESS_TOKEN)?.value;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  let payload: JwtPayload | null = null;
  if (accessToken) {
    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    if (isPublicRoute) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Server Actions are posted to whatever URL the browser is on at call time,
  // which can briefly still be a public route during a client-side navigation
  // (e.g. right after login, before the URL bar updates to /dashboard). When
  // that happens we still want to attach identity headers for an already
  // logged-in user — permission checks below stay scoped to protected routes.
  if (!isPublicRoute) {
    const navItem = findNavItemByPathname(pathname);
    if (navItem?.resource) {
      const permitted = hasPermission(payload.permissions || [], navItem.resource, navItem.action || "read");
      if (!permitted) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-organization-id", payload.organizationId);
  requestHeaders.set("x-user-permissions", JSON.stringify(payload.permissions || []));

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
