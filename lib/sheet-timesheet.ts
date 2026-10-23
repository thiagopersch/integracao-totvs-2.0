/**
 * "Apontamento mensal" layout of a Google Sheets sync: one tab per month named after it
 * ("Outubro26", "Novembro26", ...), each a copy of the previous one — a header block (empresa,
 * analista, período, horas), a column header row (DATA, NOME DO ANALISTA, HORAS EXECUTADAS, ...),
 * the demand rows and a "TOTAL DE HORAS APONTADAS" row with a SUM over them. Pure helpers: the
 * Sheets calls live in lib/google-sheets.ts.
 */

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Lowercase, no accents, no spaces/separators: "Março 2026" → "marco2026", "DESCRIÇÃO " → "descricao". */
export function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[\s\-_/.:]+/g, "");
}

const MONTH_KEYS = MONTHS.map(normalizeLabel);

export interface YearMonth {
  year: number;
  /** 1-12. */
  month: number;
}

/** "Outubro26", "outubro 26", "Outubro/2026", "MARÇO 27" → { year, month }; anything else → null. */
export function parseMonthTab(title: string): YearMonth | null {
  const match = normalizeLabel(title).match(/^([a-z]+)(\d{2}|\d{4})$/);
  if (!match) return null;
  const index = MONTH_KEYS.indexOf(match[1]);
  if (index < 0) return null;
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  return { year, month: index + 1 };
}

export const compareYearMonth = (a: YearMonth, b: YearMonth) => a.year * 12 + a.month - (b.year * 12 + b.month);

/**
 * Title of the tab for `target`, written in the same style as `like` (an existing month tab):
 * capitalization, separator and 2/4-digit year. Default style: "Outubro26".
 */
export function monthTabTitle(target: YearMonth, like?: string) {
  const style = like?.trim().match(/^(\p{L}+)([\s\-_/.]*)(\d{2}|\d{4})$/u);
  const name = MONTHS[target.month - 1];
  const word = !style
    ? name
    : style[1] === style[1].toUpperCase()
      ? name.toUpperCase()
      : style[1] === style[1].toLowerCase()
        ? name.toLowerCase()
        : name;
  const year = style?.[3].length === 4 ? String(target.year) : String(target.year % 100).padStart(2, "0");
  return `${word}${style?.[2] ?? ""}${year}`;
}

export type TimesheetField = "date" | "analyst" | "hours" | "name" | "description" | "requester" | "department" | "client";

/** Normalized header text → field. Checked in order, so "nomedoanalista" wins over a bare "demanda". */
const HEADER_FIELDS: [RegExp, TimesheetField][] = [
  [/^data$/, "date"],
  [/analista/, "analyst"],
  [/^horas?(executadas?|apontadas?|trabalhadas?)?$/, "hours"],
  [/^descricao/, "description"],
  [/demanda|atividade/, "name"],
  [/solicitante/, "requester"],
  [/setor|departamento/, "department"],
  [/^cliente/, "client"],
];

/** Zero-based cell position. */
export interface CellRef {
  row: number;
  column: number;
}

export interface TimesheetLayout {
  headerRow: number;
  firstDataRow: number;
  /** "TOTAL ..." row below the data, or null when the tab has none (data then runs to the end). */
  totalRow: number | null;
  columns: Partial<Record<TimesheetField, number>>;
  /** Value cells of the header block ("Período:" → the cell to its right). */
  periodCell: CellRef | null;
  contractedCell: CellRef | null;
  excessCell: CellRef | null;
}

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));

/** Finds the column header row, the TOTAL row and the header block cells of a month tab. */
export function detectTimesheetLayout(values: unknown[][]): TimesheetLayout | null {
  const headerRow = values.findIndex((row) => {
    const labels = row.map((cell) => normalizeLabel(text(cell)));
    return labels.includes("data") && labels.some((label) => label.startsWith("horas"));
  });
  if (headerRow < 0) return null;

  const columns: TimesheetLayout["columns"] = {};
  values[headerRow].forEach((cell, column) => {
    const label = normalizeLabel(text(cell));
    if (!label) return;
    const field = HEADER_FIELDS.find(([pattern, f]) => pattern.test(label) && columns[f] === undefined)?.[1];
    if (field) columns[field] = column;
  });
  if (columns.date === undefined || columns.hours === undefined) return null;

  let totalRow: number | null = null;
  for (let row = headerRow + 1; row < values.length; row++) {
    if (values[row]?.some((cell) => normalizeLabel(text(cell)).startsWith("total"))) {
      totalRow = row;
      break;
    }
  }

  const labelCell = (prefix: string): CellRef | null => {
    for (let row = 0; row < headerRow; row++) {
      const column = (values[row] ?? []).findIndex((cell) => normalizeLabel(text(cell)).startsWith(prefix));
      if (column >= 0) return { row, column: column + 1 };
    }
    return null;
  };

  return {
    headerRow,
    firstDataRow: headerRow + 1,
    totalRow,
    columns,
    periodCell: labelCell("periodo"),
    contractedCell: labelCell("horascontratadas"),
    excessCell: labelCell("horasexcedentes"),
  };
}

export interface TimesheetRow {
  /** Demand date (UTC midnight). */
  date: Date;
  analyst: string;
  hours: number;
  name: string;
  description: string;
  requester: string;
  department: string;
  client: string;
}

/** Google Sheets date serial (days since 1899-12-30): a real date that keeps the column's dd/mm/aaaa format. */
export const toSheetDate = (date: Date) => Math.round((date.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000);

/** "3 horas", "2,5 horas" — same wording as the header block. */
export const formatHours = (hours: number) => `${Math.round(hours * 100) / 100}`.replace(".", ",") + " horas";

/** First number in "30 horas" / "30,5h" → 30 / 30.5; null when there is none. */
export function parseHours(value: unknown): number | null {
  const match = text(value).match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : null;
}

/** Zero-based column → "A", "B", ..., "AA". */
export function columnLetter(column: number) {
  let letters = "";
  for (let n = column + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

export const cellA1 = (cell: CellRef) => `${columnLetter(cell.column)}${cell.row + 1}`;
