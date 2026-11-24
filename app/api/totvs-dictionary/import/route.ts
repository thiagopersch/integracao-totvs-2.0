import { revalidateTag } from "next/cache"
import { authorizeRoute } from "@/lib/api-auth"
import { hasPermission } from "@/lib/permissions"
import { dictionaryImportStepSchema } from "@/schemas/totvs-dictionary.schema"
import { auditService } from "@/services/audit.service"
import { totvsDictionaryService } from "@/services/totvs-dictionary.service"

/**
 * Dictionary import, in steps — the browser parses the file and sends JSON, so a 10+ MB spreadsheet
 * never hits the 4.5 MB request-body limit of serverless functions:
 *   1. `{ step: "start", mode, fileName, total }`  → `{ startedAt }` (database clock)
 *   2. `{ step: "batch", rows }` (≤ 10k rows each)  → `{ inserted, updated }`
 *   3. `{ step: "finish", mode, startedAt, ... }`  → `{ removed, total }` — "replace" deletes here the
 *      rows the import did not write, so a failure in step 2 leaves the old dictionary intact.
 */
export async function POST(request: Request) {
  const { ctx, denied } = await authorizeRoute("totvs_dictionary", "create")
  if (denied) return denied

  const body = await request.json().catch(() => null)
  const parsed = dictionaryImportStepSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return Response.json({ error: issue ? `Dados inválidos (${issue.path.join(".") || "corpo"}): ${issue.message}` : "Dados inválidos" }, { status: 400 })
  }
  const input = parsed.data
  const canDelete = hasPermission(ctx.permissions, "totvs_dictionary", "delete")

  try {
    if (input.step === "start") {
      if (input.mode === "replace" && !canDelete) return Response.json({ error: "Substituir o dicionário exige permissão de exclusão" }, { status: 403 })
      const startedAt = await totvsDictionaryService.now()
      return Response.json({ startedAt: startedAt.toISOString() })
    }

    if (input.step === "batch") {
      return Response.json(await totvsDictionaryService.upsertBatch(input.rows.map((r) => ({ ...r, description: r.description ?? "" }))))
    }

    if (input.mode === "replace" && !canDelete) return Response.json({ error: "Substituir o dicionário exige permissão de exclusão" }, { status: 403 })
    const removed = input.mode === "replace" ? await totvsDictionaryService.finalizeReplace(new Date(input.startedAt)) : 0
    const total = await totvsDictionaryService.count()
    await auditService.log({
      action: "IMPORT",
      entity: "TotvsDictionaryColumn",
      entityId: input.fileName.slice(0, 200),
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      newData: { mode: input.mode, read: input.read, skipped: input.skipped, inserted: input.inserted, updated: input.updated, removed, total },
      notify: false,
    })
    // Route Handler: updateTag is Server-Action-only; expire now so the list and sql-docs see it.
    revalidateTag("totvs-dictionary", { expire: 0 })
    return Response.json({ removed, total })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
}
