import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { MAPEADOR_CAMPO_TIPO_LABELS } from "@/types/mapeador"
import type { MapeadorProjetoDTO } from "@/types/mapeador"

/** Structured PDF (etapas + campos, one section per processo) — a simplified, printable version of the prototype flow, since capturing every screen pixel-perfectly would need one canvas render per screen. */
export function exportPrototipoPdf(projetos: MapeadorProjetoDTO[], orientation: "landscape" | "portrait" = "landscape") {
  const doc = new jsPDF({ orientation, unit: "pt" })

  projetos.forEach((projeto, index) => {
    if (index > 0) doc.addPage()
    doc.setFontSize(16)
    doc.text(`Protótipo — ${projeto.nome}`, 40, 40)

    autoTable(doc, {
      startY: 56,
      head: [["Ordem", "Etapa", "Condição para liberar a etapa"]],
      body: projeto.etapas.map((e) => [e.ordem, e.nome, e.condicao ?? ""]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [12, 193, 170] },
    })

    const camposRows = projeto.etapas.flatMap((etapa) =>
      etapa.camposPorEtapa.flatMap((passo) =>
        passo.campos.map((campo) => [etapa.nome, passo.titulo, campo.label, MAPEADOR_CAMPO_TIPO_LABELS[campo.tipo] ?? campo.tipo, campo.obrigatorio ? "Sim" : "Não"])
      )
    )

    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24,
      head: [["Etapa", "Passo", "Campo", "Tipo", "Obrigatório"]],
      body: camposRows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [12, 193, 170] },
    })
  })

  const fileName = `${(projetos[0]?.nome || "prototipo").toLowerCase().replace(/\s+/g, "-")}-prototipo.pdf`
  doc.save(fileName)
}
