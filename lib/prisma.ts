import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

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

function createPrismaClient() {
  // node-postgres defaults to 10 connections; a single dashboard render fires ~20 queries in parallel.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX) || 20,
  });
  return new PrismaClient({ adapter, omit: GLOBAL_OMIT });
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: AppPrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
