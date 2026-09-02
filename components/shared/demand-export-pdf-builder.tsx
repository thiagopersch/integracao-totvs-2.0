"use client"

import { useEffect, useRef } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toPng } from "html-to-image"
import { MultiTypeChart } from "@/components/shared/charts/multi-type-chart"
import type { getDemandExportData } from "@/actions/export"

type ExportData = Extract<Awaited<ReturnType<typeof getDemandExportData>>, { success: true }>

interface Props {
  data: ExportData
  clientLabel: string
  onDone: () => void
}

const CHART_WIDTH = 700
const CHART_HEIGHT = 300

export function DemandExportPdfBuilder({ data, clientLabel, onDone }: Props) {
  const statusRef = useRef<HTMLDivElement>(null)
  const analystRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<HTMLDivElement>(null)
  const rankingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function build() {
      // Let recharts paint into the off-screen containers before capturing them as images.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const doc = new jsPDF({ orientation: "landscape", unit: "pt" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 32
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (imgWidth / CHART_WIDTH) * CHART_HEIGHT

      doc.setFontSize(16)
      doc.text("Relatório de Demandas", margin, 40)
      doc.setFontSize(10)
      doc.text(`Cliente: ${clientLabel}`, margin, 58)
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 72)

      const chartRefs = [statusRef, analystRef, ...(data.demandsByClient.length > 0 ? [clientRef] : []), rankingRef]

      let y = 90
      for (const ref of chartRefs) {
        if (!ref.current) continue
        const png = await toPng(ref.current, { pixelRatio: 2 })
        if (y + imgHeight > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.addImage(png, "PNG", margin, y, imgWidth, imgHeight)
        y += imgHeight + 24
      }

      if (!cancelled) {
        doc.addPage();
        autoTable(doc, {
          head: [Object.keys(data.rows[0] ?? {})],
          body: data.rows.map((r) => Object.values(r)),
          styles: { fontSize: 8 },
          margin: { left: margin, right: margin },
        })

        doc.save(`demandas-${new Date().toISOString().slice(0, 10)}.pdf`)
        onDone()
      }
    }

    build().catch(() => {
      if (!cancelled) onDone()
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }} aria-hidden>
      <div ref={statusRef} style={{ width: CHART_WIDTH, height: CHART_HEIGHT, background: "var(--card)", padding: 16 }}>
        <MultiTypeChart
          data={data.demandsByStatus}
          nameKey="name"
          series={[{ key: "value", name: "Quantidade" }]}
          kind="bar-h"
          colorByIndex
          height={CHART_HEIGHT - 32}
        />
      </div>
      <div ref={analystRef} style={{ width: CHART_WIDTH, height: CHART_HEIGHT, background: "var(--card)", padding: 16 }}>
        <MultiTypeChart
          data={data.demandsByAnalyst}
          nameKey="name"
          series={[{ key: "value", name: "Quantidade", color: "var(--chart-1)" }]}
          kind="bar-h"
          height={CHART_HEIGHT - 32}
        />
      </div>
      {data.demandsByClient.length > 0 && (
        <div ref={clientRef} style={{ width: CHART_WIDTH, height: CHART_HEIGHT, background: "var(--card)", padding: 16 }}>
          <MultiTypeChart
            data={data.demandsByClient}
            nameKey="name"
            series={[{ key: "value", name: "Quantidade", color: "var(--chart-2)" }]}
            kind="bar-h"
            height={CHART_HEIGHT - 32}
          />
        </div>
      )}
      <div ref={rankingRef} style={{ width: CHART_WIDTH, height: CHART_HEIGHT, background: "var(--card)", padding: 16 }}>
        <MultiTypeChart
          data={data.clientHoursRanking}
          nameKey="name"
          series={[
            { key: "contratadas", name: "Horas contratadas", color: "var(--chart-1)" },
            { key: "gastas", name: "Horas gastas", color: "var(--chart-2)" },
          ]}
          kind="bar-h"
          height={CHART_HEIGHT - 32}
        />
      </div>
    </div>
  )
}
