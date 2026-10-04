import { NextResponse } from "next/server";
import { ForbiddenError, requirePermission } from "@/lib/rbac";

/**
 * Route Handler guard: the proxy only checks permissions for page routes listed in the nav, so each
 * `/api/*` handler must check its own. Returns the request context, or a 401/403 response.
 */
export async function authorizeRoute(resource: string, action: string = "read") {
  try {
    return { ctx: await requirePermission(resource, action), denied: null };
  } catch (error) {
    const forbidden = error instanceof ForbiddenError;
    return {
      ctx: null,
      denied: NextResponse.json(
        { error: forbidden ? error.message : "Não autenticado" },
        { status: forbidden ? 403 : 401 }
      ),
    };
  }
}
