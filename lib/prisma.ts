import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { recordQuery } from "@/lib/n-plus-one-detector";

/**
 * Heavy columns left out of every query by default (Prisma 7 global `omit`). A query that really
 * needs one opts back in with `omit: { field: false }` (or names it in a `select`) — the type
 * checker flags every place that reads an omitted field without doing so.
 *
 * `mapeadorTemplateProjeto.etapas` stays loaded: every read of a template (list counts, apply,
 * duplicate) needs it, and there are only a handful of templates per organization.
 */
export const GLOBAL_OMIT = {
  soapLog: { xmlRequest: true, xmlResponse: true, jsonResponse: true },
  backup: { contentSentence: true },
  sentence: { content: true },
  mapeadorProjeto: { prototipoConfig: true },
  mapeadorEtapa: { camposPorEtapa: true },
  auditLog: { oldData: true, newData: true },
} as const;

/** Dev-only: warns in the server log when the same statement repeats in a burst (lib/n-plus-one-detector.ts). */
const DETECT_N_PLUS_ONE = process.env.NODE_ENV === "development" && process.env.N_PLUS_ONE_DETECTOR !== "off";

/**
 * Explicit `pg.Pool` so every limit is ours, not node-postgres' defaults (10 connections, no
 * timeouts). DATABASE_URL should be the pooled (PgBouncer) Neon URL in production.
 * - max: a single dashboard render fires ~20 queries in parallel.
 * - idleTimeoutMillis: idle connections are closed before the function instance is frozen; with
 *   `attachDatabasePool` Vercel keeps the instance alive just long enough to release them.
 * - connectionTimeoutMillis: fail fast instead of hanging when the pool/DB is exhausted.
 * - statement_timeout: no runaway query holds a connection forever (per-session, set at connect).
 */
function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX) || 20,
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS) || 10_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 10_000,
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS) || 60_000,
  });
  pool.on("error", (error) => {
    // An idle client erroring (e.g. the server closed it) must not crash the process.
    console.error("[prisma] idle pg client error:", error.message);
  });
  attachDatabasePool(pool);
  return pool;
}

function createPrismaClient() {
  const adapter = new PrismaPg(createPool());
  const client = new PrismaClient({
    adapter,
    omit: GLOBAL_OMIT,
    log: DETECT_N_PLUS_ONE ? [{ emit: "event", level: "query" }] : [],
  });
  if (DETECT_N_PLUS_ONE) {
    (client as unknown as { $on(event: "query", cb: (e: { query: string }) => void): void }).$on("query", (e) => recordQuery(e.query));
  }
  return client;
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: AppPrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
