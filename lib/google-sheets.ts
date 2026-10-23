import { JWT } from "google-auth-library";
import {
  cellA1,
  columnLetter,
  compareYearMonth,
  detectTimesheetLayout,
  formatHours,
  monthTabTitle,
  parseHours,
  parseMonthTab,
  toSheetDate,
  type TimesheetField,
  type TimesheetRow,
  type YearMonth,
} from "@/lib/sheet-timesheet";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/** Validates the service account key JSON downloaded from Google Cloud (IAM > Contas de serviço > Chaves). */
export function parseServiceAccountKey(json: string): ServiceAccountKey {
  let parsed: Partial<ServiceAccountKey> & { type?: string };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("A chave da conta de serviço deve ser o arquivo JSON baixado do Google Cloud");
  }
  if (parsed.type !== "service_account" || !parsed.client_email || !parsed.private_key) {
    throw new Error("JSON inválido: use uma chave do tipo \"service_account\" (com client_email e private_key)");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

/** `https://docs.google.com/spreadsheets/d/<id>/edit...` → `<id>`. */
export function parseSpreadsheetId(url: string): string | null {
  return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? null;
}

export type SheetCell = string | number;

export class GoogleSheetsError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "GoogleSheetsError";
  }
}

function toSheetsError(error: unknown, serviceAccountEmail: string) {
  const response = (error as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
  const status = response?.status;
  const detail = response?.data?.error?.message ?? (error as Error).message;
  if (status === 403) {
    return new GoogleSheetsError(`Sem acesso à planilha: compartilhe-a com ${serviceAccountEmail} como Editor`, status);
  }
  if (status === 404) return new GoogleSheetsError("Planilha não encontrada: confira o link", status);
  if (status === 401 || /invalid_grant|invalid_client/i.test(detail)) {
    return new GoogleSheetsError("Chave da conta de serviço inválida ou revogada (Integrações > Planilhas Google)", status);
  }
  return new GoogleSheetsError(`Google Sheets: ${detail}`, status);
}

/** `'Name'!A1` notation — quotes are doubled inside the name. */
const range = (title: string, cell = "") => `'${title.replace(/'/g, "''")}'${cell ? `!${cell}` : ""}`;

/** Text starting with `= + - @` would be read as a formula with USER_ENTERED: the apostrophe keeps it text. */
const escapeCell = (value: SheetCell) => (typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value);

interface SheetProperties {
  sheetId: number;
  title: string;
  index?: number;
  gridProperties?: { rowCount: number };
}

export interface MonthlyTimesheet {
  month: YearMonth;
  /** "01/10/2026 a 31/10/2026" — written to the "Período:" cell. */
  periodLabel: string;
  rows: TimesheetRow[];
}

interface SpreadsheetMeta {
  properties: { title: string };
  sheets: { properties: SheetProperties }[];
}

export function createSheetsClient(key: ServiceAccountKey) {
  const jwt = new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });

  async function call<T>(path: string, method: "GET" | "POST" = "GET", data?: unknown): Promise<T> {
    try {
      const res = await jwt.request<T>({ url: `${API}/${path}`, method, data });
      return res.data;
    } catch (error) {
      throw toSheetsError(error, key.client_email);
    }
  }

  const getMeta = (spreadsheetId: string) =>
    call<SpreadsheetMeta>(
      `${spreadsheetId}?fields=${encodeURIComponent("properties.title,sheets(properties(sheetId,title,index,gridProperties.rowCount))")}`
    );

  return {
    /** Title of the spreadsheet — proves the key works and the sheet is shared. */
    async getTitle(spreadsheetId: string) {
      return (await getMeta(spreadsheetId)).properties.title;
    },

    /**
     * Fills the tab of `sheet.month` ("Outubro26") in its own layout (lib/sheet-timesheet.ts) —
     * no other tab is created or touched. A missing month tab is created as a copy of the latest earlier month tab,
     * right after it. Only values are written — the tab keeps its logo, colors, borders, number
     * formats and the TOTAL formula; rows are inserted above TOTAL when the demands do not fit, so
     * its SUM range grows with them.
     */
    async writeMonthlyTimesheet(spreadsheetId: string, sheet: MonthlyTimesheet) {
      const meta = await getMeta(spreadsheetId);
      const monthTabs = meta.sheets
        .map((s) => ({ properties: s.properties, month: parseMonthTab(s.properties.title) }))
        .filter((s): s is { properties: SheetProperties; month: YearMonth } => s.month !== null);

      let tab = monthTabs.find((s) => compareYearMonth(s.month, sheet.month) === 0)?.properties;
      let created = false;
      if (!tab) {
        const earlier = monthTabs.filter((s) => compareYearMonth(s.month, sheet.month) < 0);
        const template = (earlier.length ? earlier : monthTabs).sort((a, b) => compareYearMonth(b.month, a.month))[0];
        const title = monthTabTitle(sheet.month, template?.properties.title);
        if (!template) {
          throw new GoogleSheetsError(`Aba "${title}" não encontrada: crie a aba do mês (ex.: ${title}) no modelo do apontamento`);
        }
        const copy = await call<{ replies: { duplicateSheet: { properties: SheetProperties } }[] }>(`${spreadsheetId}:batchUpdate`, "POST", {
          requests: [
            {
              duplicateSheet: {
                sourceSheetId: template.properties.sheetId,
                insertSheetIndex: (template.properties.index ?? 0) + 1,
                newSheetName: title,
              },
            },
          ],
        });
        tab = copy.replies[0].duplicateSheet.properties;
        created = true;
      }

      const rowCount = tab.gridProperties?.rowCount ?? 1000;
      const grid = await call<{ values?: unknown[][] }>(
        `${spreadsheetId}/values/${encodeURIComponent(range(tab.title, `A1:Z${rowCount}`))}?valueRenderOption=FORMULA`
      );
      const values = grid.values ?? [];
      const layout = detectTimesheetLayout(values);
      if (!layout) {
        throw new GoogleSheetsError(
          `Aba "${tab.title}": cabeçalho das demandas não encontrado (linha com as colunas DATA e HORAS EXECUTADAS)`
        );
      }

      // Data rows are [firstDataRow, end) — zero-based, end exclusive.
      const { firstDataRow, columns } = layout;
      let end = layout.totalRow ?? Math.max(rowCount, firstDataRow + sheet.rows.length);
      const missing = sheet.rows.length - (end - firstDataRow);
      if (missing > 0) {
        // Above the last data row, so the TOTAL SUM range (and the data row formatting) extends to the new rows.
        const startIndex = layout.totalRow !== null ? Math.max(firstDataRow, end - 1) : end;
        await call(`${spreadsheetId}:batchUpdate`, "POST", {
          requests: [
            {
              insertDimension: {
                range: { sheetId: tab.sheetId, dimension: "ROWS", startIndex, endIndex: startIndex + missing },
                inheritFromBefore: startIndex > firstDataRow,
              },
            },
          ],
        });
        end += missing;
      }

      const fields = Object.entries(columns) as [TimesheetField, number][];
      const columnRange = (column: number) => range(tab.title, `${columnLetter(column)}${firstDataRow + 1}:${columnLetter(column)}${end}`);
      await call(`${spreadsheetId}/values:batchClear`, "POST", { ranges: fields.map(([, column]) => columnRange(column)) });

      const valueOf = (row: TimesheetRow, field: TimesheetField): SheetCell =>
        field === "date" ? toSheetDate(row.date) : field === "hours" ? row.hours : row[field];
      const data: { range: string; majorDimension?: "COLUMNS"; values: SheetCell[][] }[] = sheet.rows.length
        ? fields.map(([field, column]) => ({
            range: columnRange(column),
            majorDimension: "COLUMNS" as const,
            values: [sheet.rows.map((row) => escapeCell(valueOf(row, field)))],
          }))
        : [];

      // Header block: keep formulas the user put there, overwrite plain text.
      const cellValue = (cell: { row: number; column: number }) => values[cell.row]?.[cell.column];
      const isFormula = (cell: { row: number; column: number }) => /^=/.test(String(cellValue(cell) ?? ""));
      if (layout.periodCell && !isFormula(layout.periodCell)) {
        data.push({ range: range(tab.title, cellA1(layout.periodCell)), values: [[sheet.periodLabel]] });
      }
      const contracted = layout.contractedCell ? parseHours(cellValue(layout.contractedCell)) : null;
      if (layout.excessCell && contracted !== null && !isFormula(layout.excessCell)) {
        const total = sheet.rows.reduce((sum, row) => sum + row.hours, 0);
        data.push({ range: range(tab.title, cellA1(layout.excessCell)), values: [[formatHours(Math.max(0, total - contracted))]] });
      }

      if (data.length) await call(`${spreadsheetId}/values:batchUpdate`, "POST", { valueInputOption: "USER_ENTERED", data });
      return { tabTitle: tab.title, created };
    },
  };
}
