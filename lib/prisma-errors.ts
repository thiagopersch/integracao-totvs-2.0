import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

/** P2021 (table) / P2022 (column) — the database is behind the schema: a migration wasn't applied
 *  to the database the app is connected to (`DATABASE_URL`). */
export function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

export function logMigrationPending(feature: string, error: unknown) {
  logger.warn(`${feature}: banco de dados sem as migrations mais recentes — rode "npx prisma migrate deploy"`, {
    error: (error as Error).message,
  });
}
