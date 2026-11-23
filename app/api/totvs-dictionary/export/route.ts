import * as XLSX from "xlsx"
import { authorizeRoute } from "@/lib/api-auth"
import { DICTIONARY_HEADERS, dictionaryCsvHeader, dictionaryCsvLines } from "@/lib/totvs-dictionary"
import { totvsDictionaryService, type DictionaryFilters } from "@/services/totvs-dictionary.service"

export const maxDuration = 300

/**
 * Exports the dictionary in the reference spreadsheet layout (TABELA, COLUNA, DESCRICAO), honouring
 * the list filters: `?format=csv|xlsx&search=&table=&tablesOnly=true`. CSV is streamed.
 */
export async function GET(request: Request) {
  const { denied } = await authorizeRoute("totvs_dictionary", "read")
  if (denied) return denied

  const url = new URL(request.url)
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv"
  const filters: DictionaryFilters = {
    search: url.searchParams.get("search") ?? undefined,
    table: url.searchParams.get("table") ?? undefined,
    tablesOnly: url.searchParams.get("tablesOnly") === "true",
  }
  const fileName = `dicionario-totvs-${new Date().toISOString().slice(0, 10)}.${format}`

  if (format === "xlsx") {
    const aoa: string[][] = [[...DICTIONARY_HEADERS]]
    for await (const rows of totvsDictionaryService.iterate(filters)) for (const r of rows) aoa.push([r.table, r.column, r.description])
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    sheet["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 70 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Página1")
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // BOM so Excel opens the accents correctly.
        controller.enqueue(encoder.encode("﻿" + dictionaryCsvHeader()))
        for await (const rows of totvsDictionaryService.iterate(filters)) controller.enqueue(encoder.encode(dictionaryCsvLines(rows)))
      } catch (error) {
        controller.error(error)
        return
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" },
  })
}
