import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { findNavItemByPathname } from "@/lib/nav-items";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getClientIp } from "@/lib/client-ip";

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/api/auth"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const session = request.auth;

  // Per user when signed in (users behind the same corporate NAT/proxy no longer share one bucket),
  // per IP otherwise. Link prefetches don't count — the sidebar alone prefetches a dozen routes.
  const isPrefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (!isPrefetch) {
    const rateKey = session?.user?.id ? `api:user:${session.user.id}` : `api:ip:${getClientIp(request.headers)}`;
    if (!checkRateLimit(rateKey).allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

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

  // Security headers are set for every route in next.config.ts `headers()`.
  return NextResponse.next();
});

export const config = {
  // Static files (public/: uploaded logos under /storage and /uploads, svgs, fonts…) skip auth, the
  // DB-backed session refresh and the rate limiter entirely.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|storage/|uploads/|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|css|js|map|woff2?|ttf|txt|xml)$).*)",
  ],
};
