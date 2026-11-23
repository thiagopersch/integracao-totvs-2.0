import { requirePermission } from "@/lib/rbac"
import { logFileSchema } from "@/schemas/rubeus-logs.schema"

// No `dynamic`/`runtime` segment config — incompatible with this project's `cacheComponents`;
// reading the session (auth()) already makes this route request-time.

/**
 * "Análise de logs → Baixar arquivo": TOTVS Query/Processos/DataServer logs keep `sent`/`result`
 * as signed Google Cloud Storage links (valid ~2h). The browser can't fetch them directly (CORS)
 * nor name them, so this route downloads the file server-side and returns it as a `.txt`.
 * Only Rubeus' log bucket (`storage.googleapis.com/rb-arquivos/…`) is accepted.
 */
export async function POST(request: Request) {
  try {
    await requirePermission("ps_log_analysis", "execute")
  } catch {
    return Response.json({ error: "Sem permissão" }, { status: 403 })
  }

  const parsed = logFileSchema.safeParse(await request.json().catch(() => undefined))
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 })
  const { url, fileName } = parsed.data

  let upstream: Response
  try {
    upstream = await fetch(url, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]), redirect: "error", cache: "no-store" })
  } catch (error) {
    return Response.json({ error: `Não foi possível baixar o arquivo: ${(error as Error).message}` }, { status: 502 })
  }

  if (upstream.status === 400 || upstream.status === 403) {
    return Response.json({ error: "O link do arquivo expirou — abra o log novamente para gerar um novo link." }, { status: 410 })
  }
  if (!upstream.ok) return Response.json({ error: `O armazenamento respondeu HTTP ${upstream.status}` }, { status: 502 })

  const name = fileName.endsWith(".txt") ? fileName : `${fileName}.txt`
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  })
}
