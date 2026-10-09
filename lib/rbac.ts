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

/** Like `requirePermission`, but passes when the session holds ANY of the given grants — for
 *  actions shared by more than one screen (e.g. the PS structure readers used by both
 *  "Documentação PS" and "Busca de campos PS"). Throws for the first grant when none match. */
export async function requireAnyPermission(grants: [resource: string, action: string][]) {
  const ctx = await getRequestContext();
  if (!grants.some(([resource, action]) => hasPermission(ctx.permissions, resource, action))) {
    throw new ForbiddenError(grants[0][0], grants[0][1]);
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
