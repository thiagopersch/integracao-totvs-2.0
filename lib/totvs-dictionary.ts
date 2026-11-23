import * as XLSX from "xlsx";

/** TOTVS RM data dictionary — same layout as the reference spreadsheet: TABELA | COLUNA | DESCRICAO.
 *  The row with COLUNA "#" holds the table's own description. Pure helpers (client and server). */

export interface DictionaryRow {
  table: string;
  column: string;
  description: string;
}

export const TABLE_DESCRIPTION_COLUMN = "#";
export const DICTIONARY_HEADERS = ["TABELA", "COLUNA", "DESCRICAO"] as const;

/** Row id used by the grid and the actions: "TABELA|COLUNA". */
export function dictionaryKey(row: Pick<DictionaryRow, "table" | "column">): string {
  return `${row.table}|${row.column}`;
}

export function parseDictionaryKey(key: string): { table: string; column: string } | null {
  const i = key.indexOf("|");
  if (i <= 0 || i === key.length - 1) return null;
  return { table: key.slice(0, i), column: key.slice(i + 1) };
}

export function normalizeIdentifier(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

/** Reads a .csv / .xlsx / .xls export of the dictionary. Header names are matched case-insensitively
 *  (DESCRICAO or DESCRIÇÃO); rows without table or column are skipped; the last duplicate wins. */
export function parseDictionaryFile(data: ArrayBuffer | Uint8Array): { rows: DictionaryRow[]; read: number; skipped: number } {
  const workbook = XLSX.read(data, { type: "array", raw: true, codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [], read: 0, skipped: 0 };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  const byKey = new Map<string, DictionaryRow>();
  let skipped = 0;
  for (const r of raw) {
    const keys = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), v]));
    const table = normalizeIdentifier(keys.TABELA);
    const column = normalizeIdentifier(keys.COLUNA);
    if (!table || !column || table.includes("|") || column.includes("|")) {
      skipped++;
      continue;
    }
    byKey.set(`${table}|${column}`, { table, column, description: String(keys.DESCRICAO ?? "").trim() });
  }
  return { rows: [...byKey.values()], read: raw.length, skipped };
}

function csvCell(value: string): string {
  return /[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV lines in the spreadsheet layout (comma separated, quoted when needed). */
export function dictionaryCsvHeader(): string {
  return DICTIONARY_HEADERS.join(",") + "\r\n";
}

export function dictionaryCsvLines(rows: DictionaryRow[]): string {
  return rows.map((r) => `${csvCell(r.table)},${csvCell(r.column)},${csvCell(r.description)}\r\n`).join("");
}
