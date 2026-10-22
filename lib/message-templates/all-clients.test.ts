import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { fillTemplateHtml } from "./interpolate"
import { renderBlockTree } from "./render-email"
import { defaultTemplate } from "./defaults"
import { allowedAttachmentTypes } from "./attachments"
import { variableGroupsForEvent } from "./variable-catalog"
import { buildAllClientsDemandReportVars, buildAllClientsUsageVars, buildDemandReportVars } from "./vars-builder"
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

describe("repeated table rows", () => {
  const tableTree: BlockTree = [
    {
      id: "tb",
      type: "table",
      props: {
        hasHeader: true,
        cells: [["Cliente", "Horas"], ["{{clientName}}", "{{executedHours}}"], ["Total", "{{grandExecutedHours}}"]],
        repeatRows: [1],
      },
    },
    tree[1],
  ]

  it("render one row per client inside a single table", () => {
    const html = fillTemplateHtml(renderBlockTree(tableTree), { grandExecutedHours: "10h" }, [
      { clientName: "A", executedHours: "4h", totalHours: "4h" },
      { clientName: "B", executedHours: "6h", totalHours: "6h" },
    ])
    const table = html.slice(html.indexOf("Cliente"), html.indexOf("Total") + 30)
    expect(table).toContain(">A<")
    expect(table).toContain(">B<")
    expect(html.indexOf(">A<")).toBeLessThan(html.indexOf(">B<"))
    expect(html.indexOf(">B<")).toBeLessThan(html.indexOf("10h"))
    // header + one row per client + total, all in the same table
    const dataTable = html.slice(html.lastIndexOf("<table", html.indexOf(">Cliente<")), html.indexOf("</table>", html.indexOf("10h")))
    expect(dataTable.match(/<tr>/g)).toHaveLength(4)
    // the repeated container next to it still works
    expect(html).toContain("[A 4h]")
    expect(html).toContain("[B 6h]")
    expect(html).not.toContain("rowrepeat")
  })

  it("render once without a client list", () => {
    const html = fillTemplateHtml(renderBlockTree(tableTree), { clientName: "Único", executedHours: "1h" })
    expect(html.match(/>Único</g)).toHaveLength(1)
  })

  it("is a valid template prop", () => {
    const base = { name: "x", channel: "EMAIL", subject: "s", content: tableTree, scope: "ALL_CLIENTS", event: "DEMAND_REPORT" }
    expect(messageTemplateSchema.safeParse(base).success).toBe(true)
  })
})

describe("demand report contract variables", () => {
  const period = { label: "outubro/2026", startLabel: "01/10/2026", endLabel: "31/10/2026", slug: "2026-10" }
  const demands = [
    { durationMinutes: 600, status: "COMPLETED" },
    { durationMinutes: 120, status: "PENDING" },
    { durationMinutes: 60, status: "IN_PROGRESS" },
    { durationMinutes: 30, status: "CANCELLED" },
  ]

  it("split executed / scheduled hours and use contract + extras for the percentage", () => {
    const vars = buildDemandReportVars({ client: { name: "A" }, period, demands, usage: { baseHours: 15, extraHours: 5, contractedHours: 20 } })
    expect(vars).toMatchObject({
      executedHours: formatHours(10),
      scheduledHours: formatHours(3),
      totalHours: formatHours(13.5),
      contractBaseHours: formatHours(15),
      contractExtraHours: formatHours(5),
      contractTotalHours: formatHours(20),
      contractUsagePercent: "50%",
    })
  })

  it("show a dash without a contract", () => {
    const vars = buildDemandReportVars({ client: { name: "A" }, period, demands })
    expect(vars.contractTotalHours).toBe("—")
    expect(vars.contractUsagePercent).toBe("—")
  })

  it("sum the grand totals over the clients with a contract", () => {
    const vars = buildAllClientsDemandReportVars({
      period,
      clients: [demands, [{ durationMinutes: 600, status: "COMPLETED" }]],
      usage: [{ baseHours: 15, extraHours: 5, contractedHours: 20 }, null],
    })
    expect(vars.grandExecutedHours).toBe(formatHours(20))
    expect(vars.grandContractTotalHours).toBe(formatHours(20))
    expect(vars.grandExtraHours).toBe(formatHours(5))
    // only the contracted client's 10h count against its 20h
    expect(vars.grandUsagePercent).toBe("50%")
  })
})

describe("ALL_CLIENTS templates", () => {
  it("have defaults with a repeated container and the right attachments", () => {
    for (const event of ["DEMAND_REPORT", "CONTRACT_USAGE"] as const) {
      const d = defaultTemplate(event, "ALL_CLIENTS")
      expect(d.content.some((b) => b.type === "container" && b.props.repeatPerClient)).toBe(true)
    }
    const demandReport = defaultTemplate("DEMAND_REPORT", "ALL_CLIENTS")
    expect(demandReport.content.some((b) => b.type === "table" && b.props.repeatRows?.length)).toBe(true)
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
      {
        clientName: "Cliente A",
        rows: [row("Cliente A"), row("Cliente A")],
        minutes: 120,
        executedMinutes: 90,
        scheduledMinutes: 30,
        usage: { baseHours: 10, extraHours: 5, contractedHours: 15 },
      },
      { clientName: "Cliente B", rows: [row("Cliente B")], minutes: 30, executedMinutes: 30, scheduledMinutes: 0 },
    ])
    const wb = XLSX.read(buffer)
    expect(wb.SheetNames).toEqual(["Resumo", "Cliente A", "Cliente B"])
    const summary = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.Resumo)
    expect(summary[0]).toEqual({
      Cliente: "Cliente A",
      Demandas: 2,
      "Horas executadas": 1.5,
      "Horas programadas": 0.5,
      "Horas do contrato": 10,
      "Horas extras": 5,
      "Horas contratadas": 15,
      "Consumo (%)": 10,
    })
    expect(summary[1]).toMatchObject({ Cliente: "Cliente B", Demandas: 1, "Horas executadas": 0.5, "Horas programadas": 0 })
    // the total % only counts the clients with a contract
    expect(summary.at(-1)).toMatchObject({ Cliente: "Total", Demandas: 3, "Horas executadas": 2, "Horas contratadas": 15, "Consumo (%)": 10 })
  })

  it("leave the extra hours column out when no client has extras", () => {
    const buffer = demandsByClientXlsxBuffer([
      { clientName: "A", rows: [], minutes: 60, executedMinutes: 60, scheduledMinutes: 0, usage: { baseHours: 10, extraHours: 0, contractedHours: 10 } },
    ])
    const header = XLSX.utils.sheet_to_json<string[]>(XLSX.read(buffer).Sheets.Resumo, { header: 1 })[0]
    expect(header).not.toContain("Horas extras")
    expect(header).toContain("Consumo (%)")
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
