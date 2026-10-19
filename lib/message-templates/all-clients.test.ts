import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { fillTemplateHtml } from "./interpolate"
import { renderBlockTree } from "./render-email"
import { defaultTemplate } from "./defaults"
import { allowedAttachmentTypes } from "./attachments"
import { variableGroupsForEvent } from "./variable-catalog"
import { buildAllClientsUsageVars } from "./vars-builder"
import { messageTemplateSchema } from "@/schemas/message-template.schema"
import { demandsByClientXlsxBuffer, uniqueSheetName } from "@/lib/demands-xlsx"
import { contractUsageXlsxBuffer } from "@/lib/contract-usage-xlsx"
import { formatHours } from "@/lib/contract-usage"
import type { BlockTree } from "./block-types"

const tree: BlockTree = [
  { id: "t1", type: "text", props: { html: "<p>Total {{grandTotalHours}}</p>" } },
  {
    id: "c1",
    type: "container",
    props: { marginY: 0, marginX: 0, paddingY: 0, paddingX: 0, backgroundColor: "transparent", repeatPerClient: true },
    children: [{ id: "t2", type: "text", props: { html: "<p>[{{clientName}} {{totalHours}}]</p>" } }],
  },
  {
    id: "c2",
    type: "container",
    props: { marginY: 0, marginX: 0, paddingY: 0, paddingX: 0, backgroundColor: "transparent", repeatPerClient: true, visibleIf: "flag" },
    children: [{ id: "t3", type: "text", props: { html: "<p>flag:{{clientName}}</p>" } }],
  },
]

describe("repeatPerClient containers", () => {
  it("render once per client with that client's variables", () => {
    const html = fillTemplateHtml(renderBlockTree(tree), { grandTotalHours: "10h" }, [
      { clientName: "A", totalHours: "4h", flag: "sim" },
      { clientName: "B <x>", totalHours: "6h" },
    ])
    expect(html).toContain("Total 10h")
    expect(html.indexOf("[A 4h]")).toBeLessThan(html.indexOf("[B &lt;x&gt; 6h]"))
    // visibleIf is evaluated per client
    expect(html).toContain("flag:A")
    expect(html).not.toContain("flag:B")
    expect(html).not.toContain("<!--repeat-->")
  })

  it("render once with the email vars when there is no client list", () => {
    const html = fillTemplateHtml(renderBlockTree(tree), { grandTotalHours: "1h", clientName: "Único", totalHours: "1h" })
    expect(html.match(/\[Único 1h\]/g)).toHaveLength(1)
  })

  it("never re-expands values that look like tokens", () => {
    const html = fillTemplateHtml(renderBlockTree(tree), { grandTotalHours: "{{clientName}}" }, [{ clientName: "{{grandTotalHours}}" }])
    expect(html).toContain("Total {{clientName}}")
    expect(html).toContain("[{{grandTotalHours}} ]")
  })
})

describe("ALL_CLIENTS templates", () => {
  it("have defaults with a repeated container and the right attachments", () => {
    for (const event of ["DEMAND_REPORT", "CONTRACT_USAGE"] as const) {
      const d = defaultTemplate(event, "ALL_CLIENTS")
      expect(d.content.some((b) => b.type === "container" && b.props.repeatPerClient)).toBe(true)
    }
    expect(allowedAttachmentTypes("DEMAND_REPORT", "ALL_CLIENTS")).toEqual(["DEMANDS_XLSX"])
    expect(allowedAttachmentTypes("CONTRACT_USAGE", "ALL_CLIENTS")).toEqual(["CONTRACT_USAGE_XLSX"])
    expect(allowedAttachmentTypes("CONTRACT_USAGE", "PER_CLIENT")).toEqual([])
  })

  it("are only valid for the report events on email", () => {
    const base = { name: "x", channel: "EMAIL", subject: "s", content: defaultTemplate("GENERAL").content, scope: "ALL_CLIENTS" }
    expect(messageTemplateSchema.safeParse({ ...base, event: "BACKUP_FAILED" }).success).toBe(false)
    expect(messageTemplateSchema.safeParse({ ...base, event: "DEMAND_REPORT" }).success).toBe(true)
    expect(
      messageTemplateSchema.safeParse({ ...base, event: "CONTRACT_USAGE", scope: "PER_CLIENT", attachments: [{ type: "CONTRACT_USAGE_XLSX", fileName: "a" }] })
        .success
    ).toBe(false)
  })

  it("show the totals group only for the all-clients scope", () => {
    expect(variableGroupsForEvent("DEMAND_REPORT", "ALL_CLIENTS").some((g) => g.id === "allClients")).toBe(true)
    expect(variableGroupsForEvent("DEMAND_REPORT").some((g) => g.id === "allClients")).toBe(false)
    expect(variableGroupsForEvent("CONTRACT_USAGE", "ALL_CLIENTS").some((g) => g.id === "demand")).toBe(false)
  })

  it("sum the consumption totals", () => {
    const vars = buildAllClientsUsageVars({
      period: { label: "outubro/2026", slug: "2026-10" },
      usage: [
        { contractedHours: 40, usedHours: 30, demandsCount: 3 },
        { contractedHours: 10, usedHours: 12.5, demandsCount: 2 },
      ],
    })
    expect(vars).toMatchObject({ clientsCount: "2", grandDemandsCount: "5" })
    expect(vars.grandContractedHours).toBe(formatHours(50))
    expect(vars.grandUsedHours).toBe(formatHours(42.5))
    expect(vars.grandRemainingHours).toBe(formatHours(7.5))
  })
})

describe("all-clients spreadsheets", () => {
  it("sanitize and dedupe sheet names", () => {
    const used = new Set(["resumo"])
    expect(uniqueSheetName("A/B: C*?", used)).toBe("A B C")
    expect(uniqueSheetName("A B C", used)).toBe("A B C (2)")
    expect(uniqueSheetName("Resumo", used)).toBe("Resumo (2)")
    expect(uniqueSheetName("x".repeat(40), used)).toHaveLength(31)
  })

  it("build a summary sheet plus one sheet per client", () => {
    const row = (client: string) => ({
      Data: "01/10/2026",
      "Nome do analista": "João",
      "Horas executadas": 1,
      "Nome da demanda": "d",
      "Descrição da demanda": "",
      Solicitante: "",
      Setor: "",
      Cliente: client,
    })
    const buffer = demandsByClientXlsxBuffer([
      { clientName: "Cliente A", rows: [row("Cliente A"), row("Cliente A")], minutes: 120 },
      { clientName: "Cliente B", rows: [row("Cliente B")], minutes: 30 },
    ])
    const wb = XLSX.read(buffer)
    expect(wb.SheetNames).toEqual(["Resumo", "Cliente A", "Cliente B"])
    const summary = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Resumo)
    expect(summary.at(-1)).toEqual({ Cliente: "Total", Demandas: 3, Horas: 2.5 })
  })

  it("build the consumption sheet with a total row", () => {
    const buffer = contractUsageXlsxBuffer(
      [
        { clientName: "A", baseHours: 30, extraHours: 10, contractedHours: 40, usedHours: 30, demandsCount: 3, percent: 75, level: "ok" },
        { clientName: "B", baseHours: 10, extraHours: 0, contractedHours: 10, usedHours: 12, demandsCount: 2, percent: 120, level: "exceeded" },
      ],
      "outubro/2026"
    )
    const wb = XLSX.read(buffer)
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
    expect(rows).toHaveLength(3)
    expect(rows[1]).toMatchObject({ Cliente: "B", Excedente: 2, Saldo: 0 })
    expect(rows[2]).toMatchObject({ Cliente: "Total", "Horas contratadas": 50, "Horas utilizadas": 42, "Consumo (%)": 84 })
  })
})
