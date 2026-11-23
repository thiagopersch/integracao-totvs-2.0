import { revalidateTag } from "next/cache"
import { authorizeRoute } from "@/lib/api-auth"
import { hasPermission } from "@/lib/permissions"
import { parseDictionaryFile } from "@/lib/totvs-dictionary"
import { auditService } from "@/services/audit.service"
import { totvsDictionaryService } from "@/services/totvs-dictionary.service"

// ~136k rows go in 5k-row batches inside one transaction.
export const maxDuration = 300

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED = [".csv", ".xlsx", ".xls"]

/**
 * Imports a dictionary file (TABELA | COLUNA | DESCRICAO). multipart: `file`, `mode` = merge|replace.
 * Streams NDJSON: `{"type":"progress","done","total"}` per batch, then `{"type":"done","result"}`.
 */
export async function POST(request: Request) {
  const { ctx, denied } = await authorizeRoute("totvs_dictionary", "create")
  if (denied) return denied

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const mode = form?.get("mode") === "replace" ? "replace" : "merge"
  const fail = (error: string, status = 400) => Response.json({ type: "done", result: { success: false, error } }, { status })

  if (!(file instanceof File) || file.size === 0) return fail("Nenhum arquivo selecionado")
  if (file.size > MAX_FILE_SIZE) return fail("Arquivo excede o limite de 20 MB")
  if (!ALLOWED.some((ext) => file.name.toLowerCase().endsWith(ext))) return fail("Formato inválido. Envie .csv, .xlsx ou .xls")
  if (mode === "replace" && !hasPermission(ctx.permissions, "totvs_dictionary", "delete")) return fail("Substituir o dicionário exige permissão de exclusão", 403)

  let parsed: ReturnType<typeof parseDictionaryFile>
  try {
    parsed = parseDictionaryFile(new Uint8Array(await file.arrayBuffer()))
  } catch {
    return fail("Não foi possível ler o arquivo")
  }
  if (parsed.rows.length === 0) return fail("Nenhuma linha válida — o arquivo precisa das colunas TABELA, COLUNA e DESCRICAO")

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        } catch {
          // Client went away; the import still finishes.
        }
      }
      try {
        write({ type: "progress", done: 0, total: parsed.rows.length })
        const result = await totvsDictionaryService.import(parsed.rows, mode, (done, total) => write({ type: "progress", done, total }))
        await auditService.log({
          action: "IMPORT",
          entity: "TotvsDictionaryColumn",
          entityId: file.name.slice(0, 200),
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          newData: { mode, ...result, read: parsed.read, skipped: parsed.skipped },
          notify: false,
        })
        // Route Handler: updateTag is Server-Action-only; expire now so the list and sql-docs see it.
        revalidateTag("totvs-dictionary", { expire: 0 })
        write({ type: "done", result: { success: true, mode, read: parsed.read, skipped: parsed.skipped, ...result } })
      } catch (error) {
        write({ type: "done", result: { success: false, error: (error as Error).message } })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  })
}
