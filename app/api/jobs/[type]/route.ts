import { NextResponse } from "next/server";
import { isJobType, runJob } from "@/lib/jobs";
import { verifyQstashRequest } from "@/lib/jobs/verify";

// Backups of large TBCs and report e-mails can take minutes (Vercel Fluid compute allows up to 800 s on Pro).
export const maxDuration = 800;

/** QStash delivery of a background job (see lib/jobs). Body: `{ jobId }`, signed by QStash. */
export async function POST(request: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  const body = await request.text();
  if (!(await verifyQstashRequest(request, body))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }
  if (!isJobType(type)) return NextResponse.json({ error: `Tipo de job desconhecido: ${type}` }, { status: 404 });

  let jobId: unknown;
  try {
    jobId = (JSON.parse(body) as { jobId?: unknown }).jobId;
  } catch {
    // handled below
  }
  if (typeof jobId !== "string") return NextResponse.json({ error: "jobId ausente" }, { status: 400 });

  const outcome = await runJob(jobId);
  // A failed job answers 500 so QStash retries it (retries: 2); the BackgroundJob row keeps the error.
  return NextResponse.json(outcome, { status: outcome.status === "FAILED" ? 500 : 200 });
}
