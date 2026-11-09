import { registerOTel, type InstrumentationOptionOrName } from "@vercel/otel";

export async function register() {
  process.env.TZ = process.env.APP_TZ ?? "UTC";

  // Traces for every request, fetch and Prisma query, exported to Vercel Observability (or any
  // OTLP endpoint set through OTEL_EXPORTER_OTLP_*). Integration calls and jobs add their own spans
  // through lib/tracing.ts#withSpan.
  const instrumentations: InstrumentationOptionOrName[] = ["auto"];
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { PrismaInstrumentation } = await import("@prisma/instrumentation");
    instrumentations.push(new PrismaInstrumentation());
  }
  registerOTel({ serviceName: "integracao-totvs", instrumentations });

  // Periodic tasks: QStash schedules → /api/cron/* in production. Long-lived servers (Docker,
  // `next dev`) opt into polling here instead.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_INPROCESS_SCHEDULERS === "true") {
    const { startInprocessSchedulers } = await import("@/lib/jobs/inprocess-scheduler");
    startInprocessSchedulers();
  }
}
