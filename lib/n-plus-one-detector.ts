import { logger } from "@/lib/logger";

/**
 * Dev-only N+1 detector. Fed by Prisma's `query` log event (see lib/prisma.ts), it groups queries
 * by their parameterized SQL text — the same statement with different `$1` values is the N+1
 * signature — and warns when one statement runs more than {@link THRESHOLD} times within a short
 * burst (consecutive executions less than {@link BURST_GAP_MS} apart). Each burst warns once.
 */
const THRESHOLD = Number(process.env.N_PLUS_ONE_THRESHOLD) || 5;
const BURST_GAP_MS = 150;

type Burst = { count: number; last: number; warned: boolean };
const bursts = new Map<string, Burst>();

function normalize(sql: string): string {
  // `IN ($1,$2,$3)` lists vary in length between otherwise identical batched queries.
  return sql.replace(/\$\d+(,\s*\$\d+)*/g, "$?").replace(/\s+/g, " ").trim();
}

export function recordQuery(sql: string, now = Date.now()): string | null {
  if (/^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE)\b|^SELECT 1$/i.test(sql.trim())) return null;
  const key = normalize(sql);
  const burst = bursts.get(key);
  if (!burst || now - burst.last > BURST_GAP_MS) {
    bursts.set(key, { count: 1, last: now, warned: false });
    if (bursts.size > 500) bursts.clear();
    return null;
  }
  burst.count++;
  burst.last = now;
  if (burst.count > THRESHOLD && !burst.warned) {
    burst.warned = true;
    const message = `[N+1] mesma consulta executada ${burst.count}x em sequência: ${key.slice(0, 300)}`;
    logger.warn(message);
    return message;
  }
  return null;
}

export function resetNPlusOneDetector() {
  bursts.clear();
}
