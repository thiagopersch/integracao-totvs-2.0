import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { logger } from "@/lib/logger";

/**
 * Wraps an integration call / job in an OpenTelemetry span (exported by @vercel/otel, see
 * instrumentation.ts) and logs a warning when it takes longer than SLOW_REQUEST_MS (default 1 s).
 * Without a registered OTel SDK the span is a no-op and only the slow-call warning remains.
 */
const tracer = trace.getTracer("integracao-totvs");
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 1000;

export async function withSpan<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      const duration = Date.now() - started;
      span.setAttribute("duration_ms", duration);
      span.end();
      if (duration > SLOW_MS) logger.warn(`Chamada lenta: ${name} levou ${duration} ms`, { ...attributes, durationMs: duration });
    }
  });
}
