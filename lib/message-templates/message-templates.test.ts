import { describe, expect, it } from "vitest"
import { applyConditionals, escapeHtml, extractVariableKeys, htmlToText, interpolate } from "./interpolate"
import { renderBlockTree } from "./render-email"
import { blockTreeSchema } from "./block-schema"
import {
  addColumnToRow,
  createDefaultBlock,
  duplicateBlock,
  findBlock,
  insertBlock,
  moveBlockTo,
  removeBlock,
  removeColumnFromRow,
  resizeColumn,
  updateBlock,
} from "./block-tree-utils"
import { defaultTemplate } from "./defaults"
import { flattenVariables, VARIABLE_CATALOG, variableGroupsForEvent } from "./variable-catalog"
import { whatsappToHtml } from "./whatsapp"
import { buildContractUsageVars, buildDemandVars } from "./vars-builder"
import { resolveLinkHref, toAppPath } from "./app-link"
import type { BlockTree, ContainerBlock, RowBlock } from "./block-types"

describe("interpolate", () => {
  it("replaces tokens and escapes values by default", () => {
    expect(interpolate("Olá {{name}}!", { name: "<b>Ana</b>" })).toBe("Olá &lt;b&gt;Ana&lt;/b&gt;!")
    expect(interpolate("Olá {{ name }}", { name: "Ana" })).toBe("Olá Ana")
    expect(interpolate("{{missing}}x", {})).toBe("x")
    expect(interpolate("{{name}}", { name: "A & B" }, { escape: false })).toBe("A & B")
  })

  it("keeps or drops conditional sections", () => {
    const html = "a<!--cond:flag-->B<!--endcond-->c"
    expect(applyConditionals(html, { flag: "sim" })).toBe("aBc")
    expect(applyConditionals(html, { flag: "" })).toBe("ac")
    expect(applyConditionals(html, {})).toBe("ac")
  })

  it("converts html to text and extracts keys", () => {
    expect(htmlToText("<p>Linha 1</p><p>A &amp; B</p>")).toBe("Linha 1\nA & B")
    expect(extractVariableKeys("{{a}} {{b}} {{a}}")).toEqual(["a", "b"])
    expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;")
  })
})

describe("renderBlockTree", () => {
  it("renders every block type as table-based email html", () => {
    let tree: BlockTree = []
    for (const type of ["text", "image", "row", "container", "table", "button", "divider"] as const) {
      tree = insertBlock(tree, createDefaultBlock(type, tree), { type: "top" })
    }
    tree = updateBlock(tree, tree[1].id, (b) => ({ ...b, props: { ...b.props, src: "/storage/x.png" } }) as typeof b)
    const html = renderBlockTree(tree, { baseUrl: "https://app.test" })
    expect(html).toContain('max-width:600px')
    expect(html).toContain('src="https://app.test/storage/x.png"')
    expect(html).toContain("<th")
    expect(html).toContain("Clique aqui")
    expect(html).toContain("<hr")
    expect(html).not.toMatch(/display:\s*flex/)
  })

  it("escapes attributes and drops unsafe urls and scripts", () => {
    const tree = [
      {
        id: "b",
        type: "button" as const,
        props: {
          label: '<script>x</script>"',
          href: "javascript:alert(1)",
          bgColor: "#000",
          textColor: "#fff",
          radius: 0,
          paddingY: 0,
          paddingX: 0,
          align: "left" as const,
        },
      },
      { id: "t", type: "text" as const, props: { html: '<p onclick="x()">oi<script>bad()</script></p>' } },
      { id: "i", type: "image" as const, props: { src: '" onerror="x', alt: "a", align: "left" as const, borderRadius: 0 } },
    ]
    const html = renderBlockTree(tree)
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("onerror")
    expect(html).toContain("&lt;script&gt;")
  })

  it("keeps variable links and wraps conditional containers", () => {
    const container: ContainerBlock = {
      id: "c",
      type: "container",
      props: { marginY: 0, marginX: 0, paddingY: 0, paddingX: 0, backgroundColor: "transparent", visibleIf: "isExceeded" },
      children: [{ id: "btn", type: "button", props: { label: "Ver", href: "{{appUrl}}/contracts", bgColor: "#000", textColor: "#fff", radius: 0, paddingY: 0, paddingX: 0, align: "center" } }],
    }
    const html = renderBlockTree([container])
    expect(html).toContain('href="{{appUrl}}/contracts"')
    expect(html.startsWith("<table")).toBe(true)
    expect(html).toContain("<!--cond:isExceeded-->")
  })

  it("translates flex containers to tables", () => {
    const container: ContainerBlock = {
      id: "c",
      type: "container",
      props: { marginY: 0, marginX: 0, paddingY: 0, paddingX: 0, backgroundColor: "transparent", display: "flex", justifyContent: "center", gap: 12 },
      children: [
        { id: "d1", type: "divider", props: { color: "#000", thickness: 1, marginY: 0 } },
        { id: "d2", type: "divider", props: { color: "#000", thickness: 1, marginY: 0 } },
      ],
    }
    const html = renderBlockTree([container])
    expect(html).toContain('align="center"')
    expect(html).toContain("padding-right:12px")
  })
})

describe("block tree utils", () => {
  it("inserts, finds, moves, duplicates and removes blocks at any level", () => {
    let tree: BlockTree = []
    const row = createDefaultBlock("row", tree) as RowBlock
    tree = insertBlock(tree, row, { type: "top" })
    const text = createDefaultBlock("text", tree)
    tree = insertBlock(tree, text, { type: "top" }, 0)
    expect(tree.map((b) => b.type)).toEqual(["text", "row"])

    const child = createDefaultBlock("button", tree)
    tree = insertBlock(tree, child, { type: "column", rowId: row.id, columnId: row.children[0].id })
    expect(findBlock(tree, child.id)?.location).toEqual({ type: "column", rowId: row.id, columnId: row.children[0].id })

    // rows can't be nested
    expect(insertBlock(tree, createDefaultBlock("row", tree), { type: "column", rowId: row.id, columnId: row.children[0].id })).toBe(tree)

    tree = moveBlockTo(tree, text.id, 1)
    expect(tree.map((b) => b.type)).toEqual(["row", "text"])

    tree = duplicateBlock(tree, child.id)
    const column = (tree[0] as RowBlock).children[0]
    expect(column.children).toHaveLength(2)
    expect(column.children[1].id).not.toBe(child.id)
    expect(column.children[1].name).toBe("button2")

    tree = removeBlock(tree, child.id)
    expect((tree[0] as RowBlock).children[0].children).toHaveLength(1)
  })

  it("adds, removes and resizes columns keeping 100%", () => {
    let tree: BlockTree = [createDefaultBlock("row", [])]
    const rowId = tree[0].id
    tree = addColumnToRow(tree, rowId)
    const widths = () => (tree[0] as RowBlock).children.map((c) => c.props.widthPercent)
    expect(widths()).toEqual([33, 33, 34])
    tree = resizeColumn(tree, rowId, (tree[0] as RowBlock).children[0].id, 50)
    expect(widths().reduce((a, b) => a + b)).toBe(100)
    expect(widths()[0]).toBe(50)
    tree = removeColumnFromRow(tree, rowId, (tree[0] as RowBlock).children[2].id)
    expect(widths()).toEqual([50, 50])
  })
})

describe("schema, defaults and catalog", () => {
  it("accepts every default template and rejects nesting rows", () => {
    for (const event of ["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED", "GENERAL"] as const) {
      expect(blockTreeSchema.safeParse(defaultTemplate(event).content).success).toBe(true)
    }
    const row = createDefaultBlock("row", []) as RowBlock
    const nested = { ...row, children: [{ ...row.children[0], children: [createDefaultBlock("row", [])] }] }
    expect(blockTreeSchema.safeParse([nested]).success).toBe(false)
  })

  it("only uses catalog variables in the default templates", () => {
    const known = new Set(flattenVariables(VARIABLE_CATALOG).map((f) => f.key))
    for (const event of ["CONTRACT_USAGE", "BACKUP_FAILED", "SOAP_FAILED", "GENERAL"] as const) {
      const d = defaultTemplate(event)
      const keys = extractVariableKeys(d.subject + JSON.stringify(d.content) + d.whatsapp)
      for (const key of keys) expect(known, `${event}: ${key}`).toContain(key)
    }
  })

  it("filters variable groups by event and builds contract usage vars", () => {
    expect(variableGroupsForEvent("GENERAL").map((g) => g.id)).toEqual(["recipient", "organization", "general"])
    const vars = buildContractUsageVars({
      client: { name: "ITE" },
      usedHours: 42.5,
      contractedHours: 40,
      percent: 106.25,
      level: "exceeded",
      periodLabel: "outubro/2026",
      contracts: [{ startDate: new Date(Date.UTC(2026, 9, 1)), endDate: null, status: "ACTIVE" }],
    })
    expect(vars).toMatchObject({
      contractedHours: "40h",
      usedHours: "42,5h",
      remainingHours: "0h",
      exceededHours: "2,5h",
      usagePercent: "106,3%",
      usageLevel: "Excedido",
      contractStartDate: "01/10/2026",
      contractEndDate: "Indeterminado",
      contractStatus: "Ativo",
      isExceeded: "sim",
    })
  })

  it("renders whatsapp markup safely", () => {
    expect(whatsappToHtml("*oi* _a_ ~b~\n<x>")).toBe("<strong>oi</strong> <em>a</em> <s>b</s><br>&lt;x&gt;")
  })
})

describe("app links", () => {
  it("reduces pasted urls to paths and keeps variables", () => {
    expect(toAppPath("http://localhost:3000/contracts/123?x=1#y")).toBe("/contracts/123?x=1#y")
    expect(toAppPath("contracts")).toBe("/contracts")
    expect(toAppPath("{{appUrl}}/demands")).toBe("/demands")
    expect(toAppPath("/contracts/{{clientName}}")).toBe("/contracts/{{clientName}}")
    expect(toAppPath("  ")).toBe("")
  })

  it("prefixes app links with {{appUrl}} and leaves own urls alone", () => {
    expect(resolveLinkHref("/contracts", "app")).toBe("{{appUrl}}/contracts")
    expect(resolveLinkHref("https://site.com", "url")).toBe("https://site.com")
    expect(resolveLinkHref("https://site.com", undefined)).toBe("https://site.com")
    const html = renderBlockTree([
      {
        id: "b",
        type: "button",
        props: { label: "Ver", href: "/contracts", linkType: "app", bgColor: "#000", textColor: "#fff", radius: 0, paddingY: 0, paddingX: 0, align: "left" },
      },
    ])
    expect(interpolate(html, { appUrl: "https://app.test" })).toContain('href="https://app.test/contracts"')
  })
})

describe("extra variables", () => {
  it("builds demand vars with labels and UTC times", () => {
    const vars = buildDemandVars({
      name: "Ajuste",
      description: "Desc",
      date: new Date(Date.UTC(2026, 9, 2)),
      startTime: new Date(Date.UTC(2026, 9, 2, 8, 0)),
      endTime: new Date(Date.UTC(2026, 9, 2, 10, 30)),
      durationMinutes: 150,
      status: "COMPLETED",
      priority: "HIGH",
      demandType: { name: "Suporte" },
      department: null,
      analyst: { name: "João", email: "j@x.com" },
      requester: null,
    })
    expect(vars).toMatchObject({
      demandDate: "02/10/2026",
      demandStartTime: "08:00",
      demandEndTime: "10:30",
      demandHours: "2,5h",
      demandStatus: "Concluída",
      demandPriority: "Alta",
      demandType: "Suporte",
      demandDepartment: "",
      demandAnalystName: "João",
      demandRequesterName: "",
    })
    expect(buildDemandVars(null)).toEqual({})
  })

  it("computes contract values from the weighted hourly rate", () => {
    const vars = buildContractUsageVars({
      client: { name: "ITE" },
      usedHours: 30,
      contractedHours: 40,
      percent: 75,
      level: "ok",
      periodLabel: "outubro/2026",
      demandsCount: 7,
      contracts: [{ startDate: new Date(), endDate: null, status: "ACTIVE", contractedHours: 40, hourlyRate: 150, notes: "Remoto" }],
    })
    const norm = (v: string) => v.replace(/\s/g, " ")
    expect(norm(vars.hourlyRate)).toBe("R$ 150,00")
    expect(norm(vars.contractedValue)).toBe("R$ 6.000,00")
    expect(norm(vars.usedValue)).toBe("R$ 4.500,00")
    expect(vars).toMatchObject({ remainingPercent: "25%", demandsCount: "7", contractNotes: "Remoto" })
  })
})
