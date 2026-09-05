import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { findNavItemByPathname } from "@/lib/nav-items";
import { checkRateLimit } from "@/lib/rate-limiter";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/api/auth"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rateCheck = checkRateLimit(`api:${ip}`);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const session = request.auth;

  if (!session?.user) {
    if (isPublicRoute) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // A user flagged for a forced password reset (admin reset, or self-service "must change
  // password") can only reach /reset-password until they complete it — everything else,
  // including permission-gated routes, redirects there first.
  if (session.user.changePassword && pathname !== "/reset-password" && !pathname.startsWith("/api/auth")) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }
  if (!session.user.changePassword && pathname === "/reset-password") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Server Actions are posted to whatever URL the browser is on at call time,
  // which can briefly still be a public route during a client-side navigation
  // (e.g. right after login, before the URL bar updates to /dashboard). When
  // that happens we still want to let an already logged-in user through —
  // permission checks below stay scoped to protected routes.
  if (!isPublicRoute) {
    const navItem = findNavItemByPathname(pathname);
    if (navItem?.resource) {
      const permitted = hasPermission(session.user.permissions || [], navItem.resource, navItem.action || "read");
      if (!permitted) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
