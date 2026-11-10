import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError, requireAnyPermission } from "@/lib/rbac";
import { getDemandAnalystScope } from "@/lib/demand-scope";
import { isLookupEntity, lookupService, type LookupEntity } from "@/services/lookup.service";

/**
 * Paginated autocomplete: `GET /api/lookup/{entity}?q=&cursor=&limit=` → `{ items: {id,label,color?}[], nextCursor }`.
 * `?ids=a,b` resolves the labels of already-selected values instead. A GET route (not a Server
 * Action) so the client can cancel it with AbortController and it doesn't queue behind other actions.
 *
 * Besides the registry's own read permission, the screens that pick that registry in a form can
 * read it too (e.g. the demand form picks clients/requesters without `clients:read`).
 */
const GRANTS: Record<LookupEntity, [string, string][]> = {
  clients: [["clients", "read"], ["demands", "read"], ["projects", "read"], ["contracts", "read"]],
  requesters: [["requesters", "read"], ["demands", "read"]],
  analysts: [["analysts", "read"], ["demands", "read"], ["projects", "read"]],
  departments: [["departments", "read"], ["demands", "read"]],
  "demand-types": [["demand_types", "read"], ["demands", "read"]],
  tags: [["tags", "read"], ["demands", "read"], ["projects", "read"]],
  projects: [["projects", "read"], ["demands", "read"]],
  demands: [["demands", "read"]],
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: `Entidade desconhecida: ${entity}` }, { status: 404 });
  }

  let requestCtx;
  try {
    requestCtx = await requireAnyPermission(GRANTS[entity]);
  } catch (error) {
    const forbidden = error instanceof ForbiddenError;
    return NextResponse.json({ error: forbidden ? error.message : "Não autenticado" }, { status: forbidden ? 403 : 401 });
  }

  const params = request.nextUrl.searchParams;
  const ids = params.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);
  const analystScope = entity === "demands" ? await getDemandAnalystScope(requestCtx) : undefined;

  const page = await lookupService.search(
    entity,
    { organizationId: requestCtx.organizationId, allowedClientIds: requestCtx.allowedClientIds, analystScope },
    { q: params.get("q") ?? undefined, cursor: params.get("cursor"), limit: Number(params.get("limit")) || undefined, ids }
  );
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
