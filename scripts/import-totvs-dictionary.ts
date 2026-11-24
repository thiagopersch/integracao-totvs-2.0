import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { parseDictionaryFile } from "../lib/totvs-dictionary";
import { totvsDictionaryService } from "../services/totvs-dictionary.service";

/**
 * Imports the TOTVS RM data dictionary (columns TABELA / COLUNA / DESCRICAO) into
 * `totvs_dictionary_columns` — the same import as the "Importar" button of /totvs/dictionary.
 *
 *   npm run totvs:dictionary:import -- ./dicionario.csv            (mescla)
 *   npm run totvs:dictionary:import -- ./dicionario.csv --replace  (substitui tudo)
 */

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: npm run totvs:dictionary:import -- <arquivo .csv ou .xlsx> [--replace]");
    process.exit(1);
  }
  const mode = process.argv.includes("--replace") ? "replace" : "merge";
  const { rows, read, skipped } = parseDictionaryFile(new Uint8Array(readFileSync(file)));
  console.log(`Linhas lidas: ${read} · válidas: ${rows.length} · ignoradas: ${skipped}`);
  if (rows.length === 0) {
    console.error("Nenhuma linha válida — o arquivo precisa das colunas TABELA, COLUNA e DESCRICAO.");
    process.exit(1);
  }
  const result = await totvsDictionaryService.import(rows, mode, (done, total) => process.stdout.write(`\rImportados: ${done}/${total}`));
  console.log(`\nConcluído (${mode === "replace" ? "substituição" : "mesclagem"}): ${result.inserted} novos, ${result.updated} atualizados${mode === "replace" ? `, ${result.removed} removidos` : ""}. Registros no dicionário: ${result.total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
