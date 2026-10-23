import { prisma } from "@/lib/prisma";
import { assertClientAllowed } from "@/lib/client-access";
import type { RequestContext } from "@/lib/tenant";

/** Report schedules and sheet syncs run with no user in context, so their clients must fit the
 *  creator's scope: "every client" (empty list) is only allowed to users who can see every client
 *  of the organization. */
export async function assertClientListScope(clientIds: string[], ctx: RequestContext) {
  if (clientIds.length) {
    clientIds.forEach((id) => assertClientAllowed(id, ctx.allowedClientIds));
    return;
  }
  const total = await prisma.client.count({ where: { organizationId: ctx.organizationId, deletedAt: null } });
  const visible = await prisma.client.count({
    where: { organizationId: ctx.organizationId, deletedAt: null, id: { in: ctx.allowedClientIds } },
  });
  if (visible < total) throw new Error("Selecione os clientes (você não tem acesso a todos os clientes)");
}
