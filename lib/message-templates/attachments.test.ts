import { describe, expect, it } from "vitest"
import { parseTemplateAttachments, resolveAttachmentFileName } from "./attachments"
import { buildDemandReportVars } from "./vars-builder"

describe("template attachments", () => {
  it("interpolates and sanitizes the file name, adding .xlsx", () => {
    expect(resolveAttachmentFileName("demandas-{{clientName}}-{{periodSlug}}", { clientName: "ITE / Toledo", periodSlug: "2026-10" })).toBe(
      "demandas-ITE - Toledo-2026-10.xlsx"
    )
    expect(resolveAttachmentFileName("relatorio.xlsx", {})).toBe("relatorio.xlsx")
    expect(resolveAttachmentFileName("{{missing}}", {})).toBe("anexo.xlsx")
  })

  it("drops invalid attachment entries from the JSON column", () => {
    expect(parseTemplateAttachments([{ type: "DEMANDS_XLSX", fileName: "a.xlsx" }, { type: "PDF" }, null])).toEqual([
      { type: "DEMANDS_XLSX", fileName: "a.xlsx" },
    ])
    expect(parseTemplateAttachments(null)).toEqual([])
  })

  it("summarizes the report period for the template variables", () => {
    const vars = buildDemandReportVars({
      client: { name: "ITE - Toledo" },
      period: { label: "outubro/2026", startLabel: "01/10/2026", endLabel: "31/10/2026", slug: "2026-10" },
      demands: [
        { durationMinutes: 90, demandAnalysts: [{ analyst: { name: "Maria" } }] },
        { durationMinutes: 60, demandAnalysts: [{ analyst: { name: "João" } }] },
        { durationMinutes: 30, demandAnalysts: [{ analyst: { name: "Maria" } }] },
      ],
    })
    expect(vars).toMatchObject({
      clientName: "ITE - Toledo",
      periodLabel: "outubro/2026",
      demandsCount: "3",
      totalHours: "3h",
      analystsNames: "João, Maria",
    })
  })
})
