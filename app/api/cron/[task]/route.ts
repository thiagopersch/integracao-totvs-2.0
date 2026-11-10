import { NextResponse } from "next/server";
import { isCronTask, runCronTask } from "@/lib/jobs/cron";
import { hasValidCronSecret, verifyQstashRequest } from "@/lib/jobs/verify";

export const maxDuration = 300;

/**
 * Periodic task trigger: `POST /api/cron/{backup|project-deadline|demand-report|sheet-sync}` from a
 * QStash schedule (signed), or `GET`/`POST` with `Authorization: Bearer $CRON_SECRET` (Vercel Cron,
 * manual runs). The tick only enqueues the due work — the jobs themselves run in /api/jobs/*.
 */
async function handle(request: Request, ctx: { params: Promise<{ task: string }> }) {
  const { task } = await ctx.params;
  const body = request.method === "POST" ? await request.text() : "";
  const authorized = hasValidCronSecret(request) || (request.method === "POST" && (await verifyQstashRequest(request, body)));
  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!isCronTask(task)) return NextResponse.json({ error: `Tarefa desconhecida: ${task}` }, { status: 404 });
  try {
    return NextResponse.json({ task, result: await runCronTask(task) });
  } catch (error) {
    return NextResponse.json({ task, error: (error as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
