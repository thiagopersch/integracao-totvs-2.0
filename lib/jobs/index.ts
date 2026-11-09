import { Client } from "@upstash/qstash";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma/client";
import { isJobType, type JobPayloads, type JobType } from "@/lib/jobs/types";

export { JOB_TYPES, isJobType, type JobPayloads, type JobType } from "@/lib/jobs/types";

/**
 * Background jobs. `enqueue()` records a BackgroundJob row and hands its id to Upstash QStash, which
 * POSTs it to `/api/jobs/<type>` (signature-verified, long maxDuration) with retries and per-type
 * concurrency limits. Without QSTASH_TOKEN (local dev, Docker) the job runs in the same process
 * right after the response, through `after()` — same code path, no infrastructure needed.
 */
const qstashToken = process.env.QSTASH_TOKEN;
const qstash = qstashToken ? new Client({ token: qstashToken, baseUrl: process.env.QSTASH_URL || undefined }) : null;

export const hasQueue = qstash !== null;

/** How many jobs of a type QStash runs at once (across all instances). */
const PARALLELISM: Record<JobType, number> = {
  "backup.filter": 3,
  "demand-report.run": 2,
  "sheet-sync.run": 2,
  "notification.email": 5,
};

/** Public base URL QStash calls back. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL are set by Vercel. */
export function appBaseUrl(): string {
  const explicit = process.env.JOBS_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !/localhost|127\.0\.0\.1/.test(explicit)) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return (explicit || "http://localhost:3000").replace(/\/+$/, "");
}

export type EnqueueOptions = {
  organizationId: string;
  userId?: string | null;
  /** Same id while a previous job is still queued/running → no second job (scheduler ticks overlap). */
  dedupeId?: string;
};

export async function enqueue<T extends JobType>(type: T, payload: JobPayloads[T], options: EnqueueOptions): Promise<{ jobId: string; deduped: boolean }> {
  if (options.dedupeId) {
    const existing = await prisma.backgroundJob.findFirst({
      where: { dedupeId: options.dedupeId, status: { in: ["QUEUED", "RUNNING"] } },
      select: { id: true },
    });
    if (existing) return { jobId: existing.id, deduped: true };
  }

  const job = await prisma.backgroundJob.create({
    data: {
      organizationId: options.organizationId,
      createdById: options.userId ?? null,
      type,
      payload: payload as Prisma.InputJsonValue,
      dedupeId: options.dedupeId,
    },
    select: { id: true },
  });

  if (qstash) {
    await qstash.publishJSON({
      url: `${appBaseUrl()}/api/jobs/${type}`,
      body: { jobId: job.id },
      retries: 2,
      ...(options.dedupeId ? { deduplicationId: options.dedupeId.replace(/[^a-zA-Z0-9_.-]/g, "_") } : {}),
      flowControl: { key: `job-${type.replace(/\./g, "-")}`, parallelism: PARALLELISM[type] },
    });
  } else {
    runSoon(() => runJob(job.id));
  }
  return { jobId: job.id, deduped: false };
}

/** `after()` inside a request; outside one (the in-process schedulers) just let the promise run. */
function runSoon(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task().catch((error) => logger.error("Job inline falhou", { error: (error as Error).message }));
  }
}

/**
 * Executes one job (called by `/api/jobs/[type]` or inline). Idempotent per delivery: a job that
 * already finished is not run again when QStash redelivers it.
 */
export async function runJob(jobId: string): Promise<{ status: "DONE" | "FAILED" | "SKIPPED"; error?: string }> {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "DONE") return { status: "SKIPPED" };
  if (!isJobType(job.type)) {
    await prisma.backgroundJob.update({ where: { id: jobId }, data: { status: "FAILED", error: `Tipo de job desconhecido: ${job.type}`, finishedAt: new Date() } });
    return { status: "FAILED", error: "unknown type" };
  }

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 }, error: null },
  });
  const { JOB_HANDLERS } = await import("@/lib/jobs/handlers");
  const { withSpan } = await import("@/lib/tracing");
  try {
    const result = await withSpan(`job ${job.type}`, { "job.type": job.type, "job.id": job.id }, () =>
      JOB_HANDLERS[job.type as JobType](job.payload as never, { jobId: job.id, organizationId: job.organizationId, createdById: job.createdById })
    );
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: "DONE", result: (result ?? null) as Prisma.InputJsonValue, finishedAt: new Date() },
    });
    return { status: "DONE" };
  } catch (error) {
    const message = (error as Error).message;
    logger.error("Job falhou", { jobId, type: job.type, error: message });
    await prisma.backgroundJob.update({ where: { id: jobId }, data: { status: "FAILED", error: message, finishedAt: new Date() } });
    return { status: "FAILED", error: message };
  }
}
