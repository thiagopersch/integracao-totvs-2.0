/** Client-side table exports (CSV/Excel/PDF) shared by the DataTable "Processos" menu and pages with their own rows. */

export type ExportFormat = "csv" | "xlsx" | "pdf"
export type ExportCell = string | number | Date | null | undefined
/** A cell that should render as a hyperlink in Excel (shown as the URL itself elsewhere). */
export type ExportLink = { text: string; link: string }
export type ExportValue = ExportCell | ExportLink

export interface ExportTable {
  headers: string[]
  rows: ExportValue[][]
}

/** Excel refuses cells longer than this. */
export const XLSX_CELL_LIMIT = 32_767

export function isExportLink(v: unknown): v is ExportLink {
  return !!v && typeof v === "object" && !(v instanceof Date) && "link" in v
}

/** Plain text of a cell (links → their text, dates → pt-BR). */
export function exportCellText(v: ExportValue, dateFormat: "date" | "datetime" = "datetime"): string {
  if (v === null || v === undefined) return ""
  if (isExportLink(v)) return v.text
  if (v instanceof Date) return dateFormat === "date" ? v.toLocaleDateString("pt-BR") : v.toLocaleString("pt-BR")
  return String(v)
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** `;`-separated CSV with a UTF-8 BOM (opens correctly in a pt-BR Excel). */
export function exportRowsAsCsv({ headers, rows }: ExportTable, fileName: string) {
  const cell = (v: ExportValue) => {
    const text = exportCellText(v)
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = [headers.map(cell), ...rows.map((r) => r.map(cell))].map((r) => r.join(";")).join("\r\n")
  download(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), fileName.endsWith(".csv") ? fileName : `${fileName}.csv`)
}

/** Single-sheet .xlsx; `autoWidth` sizes columns from their content (max 60), `autoFilter` turns on header filters. */
export async function exportRowsAsXlsx(
  { headers, rows }: ExportTable,
  fileName: string,
  options: { sheetName?: string; autoWidth?: boolean; autoFilter?: boolean } = {}
) {
  const XLSX = await import("xlsx")
  const plain = rows.map((r) =>
    r.map((v) => {
      if (isExportLink(v)) return v.text.slice(0, XLSX_CELL_LIMIT)
      return typeof v === "string" ? v.slice(0, XLSX_CELL_LIMIT) : (v ?? "")
    })
  )
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...plain])
  rows.forEach((r, ri) =>
    r.forEach((v, ci) => {
      if (!isExportLink(v)) return
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
      if (sheet[ref]) sheet[ref].l = { Target: v.link }
    })
  )
  if (options.autoWidth) {
    sheet["!cols"] = headers.map((h, i) => ({
      wch: Math.min(60, Math.max(h.length, ...rows.map((r) => exportCellText(r[i]).length)) + 2),
    }))
  }
  if (options.autoFilter && sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] }
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, options.sheetName ?? "Dados")
  XLSX.writeFile(book, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`)
}

/** Landscape PDF table with a title and a "generated at" line. */
export async function exportRowsAsPdf({ headers, rows }: ExportTable, fileName: string, title: string, subtitle?: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" })
  doc.setFontSize(14)
  doc.text(title, 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text(`${subtitle ? `${subtitle} · ` : ""}Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} registro(s)`, 40, 56)
  autoTable(doc, {
    startY: 70,
    head: [headers],
    body: rows.map((row) => row.map((v) => exportCellText(v, "date"))),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [34, 139, 84], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 246] },
    margin: { left: 40, right: 40 },
  })
  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`)
}
