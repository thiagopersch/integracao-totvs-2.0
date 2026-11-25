"use client"

import { Copy, Download } from "lucide-react"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CollapsibleCardHeader } from "@/components/shared/collapsible-card-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TpiPixData } from "@/actions/integrations/tpi"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Sim" : "Não"
  return String(value)
}

function money(value: unknown): string {
  return typeof value === "number" ? brl.format(value) : show(value)
}

async function copy(value: string, what: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${what} copiado.`)
  } catch {
    toast.error("Não foi possível copiar.")
  }
}

interface TpiPixResultProps {
  data: TpiPixData
  httpStatus?: number
  open: boolean
  onToggle: () => void
}

/** Formatted view of the DadosPagamentoPix response: QR image, copia-e-cola code, summary and boletos. */
export function TpiPixResult({ data, httpStatus, open, onToggle }: TpiPixResultProps) {
  const qrImage = typeof data.QrCode === "string" && data.QrCode.startsWith("data:image/") ? data.QrCode : null
  const qrText = typeof data.QrCodeTexto === "string" ? data.QrCodeTexto : ""
  const ok = data.CodReturno === 1
  const boletos = Array.isArray(data.BoletosLan) ? data.BoletosLan : []

  const summary: Array<[string, string]> = [
    ["Valor", money(data.Valor)],
    ["Carteira", show(data.IdCarteira)],
    ["ID Transação", show(data.IdTrasancao)],
    ["Data de expiração", show(data.DataExpiracao)],
    ["Coligada / Filial", `${show(data.CodColigada)} / ${show(data.CodFilial)}`],
    ["Status", show(data.Status)],
    ["Status da transação", show(data.StatusTransacao)],
    ["Data da operação", show(data.DataOperacao)],
    ["Data do pagamento", show(data.DataPagamento)],
    ["NSU", show(data.NSU)],
    ["ID Processo", show(data.IdProcesso)],
    ["Canal de pagamento", show(data.CanalPagamento)],
    ["Código de retorno", show(data.CodReturno)],
    ["Mensagem", show(data.Mensagem)],
    ["Valida CNAB PIX", show(data.ValidaCNABPix)],
    ["Internal ID", show(data.InternalId)],
  ]

  return (
    <Card>
      <CollapsibleCardHeader
        title="Pagamento PIX"
        open={open}
        onToggle={onToggle}
        controlsId="tpi-pix"
        summary={money(data.Valor)}
        aside={
          <>
            {httpStatus !== undefined && <Badge variant="outline">HTTP {httpStatus}</Badge>}
            <Badge variant={ok ? "success" : "destructive"}>{ok ? "PIX gerado" : "PIX não gerado"}</Badge>
          </>
        }
      />
      <CardContent id="tpi-pix" hidden={!open} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            {qrImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URI from the API */}
                <img src={qrImage} alt="QR Code PIX" className="aspect-square w-full max-w-60 rounded-md border bg-white p-2" />
                <Button variant="outline" size="sm" render={<a href={qrImage} download={`pix-${data.IdTrasancao ?? "qrcode"}.png`} />}>
                  <Download className="h-4 w-4" /> Baixar PNG
                </Button>
              </>
            ) : (
              <div className="flex aspect-square w-full max-w-60 items-center justify-center rounded-md border text-sm text-muted-foreground">
                QR Code indisponível
              </div>
            )}
          </div>

          <div className="space-y-4 min-w-0">
            <div>
              <p className="text-xs text-muted-foreground mb-1">PIX copia e cola</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 min-w-0 break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{qrText || "—"}</code>
                {qrText && (
                  <Button variant="outline" size="icon" onClick={() => copy(qrText, "Código PIX")} aria-label="Copiar código PIX">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {data.Link && data.Link !== qrText && (
                <p className="mt-2 text-xs break-all">
                  <span className="text-muted-foreground">Link: </span>
                  {data.Link}
                </p>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {summary.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 border-b border-border/50 py-1 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 font-medium break-words sm:text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Boletos / Lançamentos</p>
          {boletos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum boleto retornado.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coligada</TableHead>
                  <TableHead>ID Boleto</TableHead>
                  <TableHead>ID Lançamento</TableHead>
                  <TableHead className="text-right">Valor pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boletos.map((b, i) => (
                  <TableRow key={`${b.IdBoleto}-${i}`}>
                    <TableCell>{show(b.CodColigada)}</TableCell>
                    <TableCell>{show(b.IdBoleto)}</TableCell>
                    <TableCell>{show(b.IdLan)}</TableCell>
                    <TableCell className="text-right">{money(b.ValorPago)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
