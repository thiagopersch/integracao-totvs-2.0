import { getRequestContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export class ForbiddenError extends Error {
  constructor(resource: string, action: string) {
    super(`Sem permissão para ${action}:${resource}`);
    this.name = "ForbiddenError";
  }
}

export async function requirePermission(resource: string, action: string = "read") {
  const ctx = await getRequestContext();
  if (!hasPermission(ctx.permissions, resource, action)) {
    throw new ForbiddenError(resource, action);
  }
  return ctx;
}

/**
 * Server Action guard that returns the action's usual `{ success: false, error }` shape instead of
 * throwing. Every exported Server Action is a public POST endpoint (callable without the UI, even
 * from a page reachable without login), so each mutating action must check the session itself.
 *
 *   const denied = await denyUnlessPermitted("settings", "manage")
 *   if (denied) return denied
 */
export async function denyUnlessPermitted(resource: string, action: string = "read") {
  try {
    await requirePermission(resource, action);
    return null;
  } catch (error) {
    const message = error instanceof ForbiddenError ? error.message : "Sessão expirada. Faça login novamente.";
    return { success: false as const, error: message };
  }
}
