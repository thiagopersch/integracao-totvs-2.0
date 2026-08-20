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
