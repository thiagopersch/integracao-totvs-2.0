"use client"

import { toast } from "sonner"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exportMapeadorProjetoXlsx } from "@/actions/mapeador-export"
import { useMapeadorStore } from "@/store/mapeador.store"
import { MAPEADOR_CAMPO_TIPO_LABELS } from "@/types/mapeador"

const INFO_LABELS: Record<string, string> = {
  idProcessoSeletivo: "Identificador (ID) do Processo Seletivo",
  idRelatorioContrato: "Identificador (ID) do relatório do contrato",
  classificacaoConvocacao: "Classificação/Convocação",
  criterioClassificacao: "Critério para classificação",
  agendamento: "Agendamento",
}

function downloadBase64(base64: string, fileName: string) {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function VisualizadorTab() {
  const projeto = useMapeadorStore((s) => s.projeto)!

  async function handleExportXlsx() {
    const result = await exportMapeadorProjetoXlsx(projeto.id)
    if (!result.success) return toast.error(result.error || "Erro ao exportar Excel")
    downloadBase64(result.base64, result.fileName)
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={handleExportXlsx}>
          <Download className="h-4 w-4" /> Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimir / Exportar PDF
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="rounded-t-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">
            Etapas da ficha — {projeto.nome}
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Ordem</TableHead>
                  <TableHead>Etapas da ficha</TableHead>
                  <TableHead>Condição para liberar a etapa</TableHead>
                  <TableHead>Regras/Validações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projeto.etapas.map((etapa, index) => (
                  <TableRow key={etapa.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-semibold">{etapa.nome}</TableCell>
                    <TableCell>{etapa.condicao}</TableCell>
                    <TableCell className="whitespace-pre-wrap">{etapa.regras}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <div className="rounded-t-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Informações adicionais</div>
          <CardContent className="space-y-2 pt-4 text-sm">
            {Object.entries(INFO_LABELS).map(([field, label]) => (
              <div key={field} className="flex items-center justify-between gap-2 border-b pb-1">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{projeto.informacoesAdicionais[field as keyof typeof projeto.informacoesAdicionais] || "-"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="rounded-t-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Campos por etapa</div>
        <CardContent className="overflow-x-auto p-4">
          <div className="flex gap-4">
            {projeto.etapas.map((etapa) => (
              <div key={etapa.id} className="w-64 shrink-0 space-y-2">
                <div className="rounded-md bg-muted px-2 py-1 text-center text-sm font-semibold">{etapa.nome}</div>
                {etapa.camposPorEtapa.map((passo) => (
                  <div key={passo.id} className="space-y-1 rounded-md border p-2">
                    <div className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">{passo.titulo}</div>
                    {passo.campos.map((campo) => (
                      <div key={campo.id} className="flex items-center justify-between gap-1 text-xs">
                        {campo.tipo === "botao" ? (
                          <span className="w-full rounded bg-fuchsia-100 px-1.5 py-0.5 text-center font-semibold text-fuchsia-900">{campo.label}</span>
                        ) : (
                          <>
                            <span className="truncate">
                              {campo.label} {campo.obrigatorio && <span className="text-destructive">*</span>}
                            </span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {MAPEADOR_CAMPO_TIPO_LABELS[campo.tipo]?.replace("Campo - ", "") ?? campo.tipo}
                            </Badge>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
