import "dotenv/config";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

/**
 * Imports the TOTVS RM data dictionary (columns TABELA / COLUNA / DESCRICAO) into
 * `totvs_dictionary_columns`, used by the SQL query documentation (/rubeus/sql-docs).
 *
 * Export the spreadsheet as .csv or .xlsx (Arquivo > Fazer download) and run:
 *   npm run totvs:dictionary:import -- ./dicionario.csv
 *
 * Additive and idempotent: existing (table, column) pairs get their description updated, new ones
 * are inserted, nothing is deleted.
 */

const BATCH = 5000;

function norm(value: unknown): string {
  return String(value ?? "").trim();
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: npm run totvs:dictionary:import -- <arquivo .csv ou .xlsx>");
    process.exit(1);
  }

  const workbook = XLSX.read(readFileSync(file), { type: "buffer", raw: true, codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  const byKey = new Map<string, { table: string; column: string; description: string }>();
  for (const row of rows) {
    const keys = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toUpperCase(), v]));
    const table = norm(keys.TABELA).toUpperCase();
    const column = norm(keys.COLUNA).toUpperCase();
    const description = norm(keys.DESCRICAO ?? keys["DESCRIÇÃO"]);
    if (!table || !column) continue;
    byKey.set(`${table}.${column}`, { table, column, description });
  }
  const entries = [...byKey.values()];
  console.log(`Linhas lidas: ${rows.length} · válidas (sem duplicidade): ${entries.length}`);
  if (entries.length === 0) {
    console.error("Nenhuma linha válida — o arquivo precisa das colunas TABELA, COLUNA e DESCRICAO.");
    process.exit(1);
  }

  let done = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH);
    // One statement per batch: insert, or refresh the description of a pair that already exists.
    const values = chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(",");
    const params = chunk.flatMap((e) => [e.table, e.column, e.description]);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "totvs_dictionary_columns" ("table","column","description") VALUES ${values}
       ON CONFLICT ("table","column") DO UPDATE SET "description" = EXCLUDED."description"`,
      ...params
    );
    done += chunk.length;
    process.stdout.write(`\rImportados: ${done}/${entries.length}`);
  }
  const total = await prisma.totvsDictionaryColumn.count();
  console.log(`\nConcluído. Registros no dicionário: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
