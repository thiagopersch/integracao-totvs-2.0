// Cached reads for the SQL query documentation (/rubeus/sql-docs). Deliberately NOT a "use server"
// module — callers resolve the request context (and permission) first and pass organizationId.

import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { DictionaryTable } from "@/lib/sql-docs/prompt";

/** Whole dictionary entries of the given tables (table description = column "#"). Global data —
 *  only changes when scripts/import-totvs-dictionary.ts runs, so it is cached for hours. */
export async function getDictionaryForTables(tables: string[]): Promise<DictionaryTable[]> {
  "use cache";
  cacheTag("totvs-dictionary");
  cacheLife("hours");
  if (tables.length === 0) return [];
  const rows = await prisma.totvsDictionaryColumn.findMany({
    where: { table: { in: tables.map((t) => t.toUpperCase()) } },
    orderBy: [{ table: "asc" }, { column: "asc" }],
  });
  const byTable = new Map<string, DictionaryTable>();
  for (const row of rows) {
    let entry = byTable.get(row.table);
    if (!entry) byTable.set(row.table, (entry = { table: row.table, description: null, columns: [] }));
    if (row.column === "#") entry.description = row.description;
    else entry.columns.push({ column: row.column, description: row.description });
  }
  return [...byTable.values()];
}

export async function countDictionaryRows(): Promise<number> {
  "use cache";
  cacheTag("totvs-dictionary");
  cacheLife("hours");
  return prisma.totvsDictionaryColumn.count();
}

/** Active sentences to pick from (without the SQL, which is loaded on selection). */
export async function listSentencesForDocs(organizationId: string) {
  "use cache";
  cacheTag("sentences");
  return prisma.sentence.findMany({
    where: { organizationId, deletedAt: null, status: true },
    select: { id: true, code: true, name: true, category: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
}
