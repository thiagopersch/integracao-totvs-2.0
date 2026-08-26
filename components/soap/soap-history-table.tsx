"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/utils/cn"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { CodeEditor } from "@/components/shared/code-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatDuration } from "@/utils/format"
import { formatXml, formatXmlDeep } from "@/utils/xml"
import { reexecuteSoapLog } from "@/actions/soap"
import { Eye, RotateCcw, Maximize2, Minimize2 } from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import type { SoapLog } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

type SoapLogRow = SoapLog & { user?: { id: string; name: string } | null }

interface SoapHistoryTableProps {
  data: SoapLogRow[]
  meta: PaginationMeta
}

/** Some logged values are plain scalars (e.g. AutenticaAcessoResult "1", CheckServiceActivityResult
 *  "true") rather than XML — formatXml silently returns "" for those, so fall back to the raw text. */
function safeFormatXml(value: string): string {
  try {
    const formatted = formatXml(value)
    return formatted.trim() ? formatted : value
  } catch {
    return value
  }
}

/** ReadViewResult/GetSchemaResult-style fields nest a second, XML-escaped XML document inside a
 *  text node — safeFormatXml only unescapes the outer envelope, so fall back to that if the
 *  deeper re-parse fails instead of showing the raw, unescaped blob. */
function safeFormatXmlDeep(value: string): string {
  try {
    const formatted = formatXmlDeep(value)
    return formatted.trim() ? formatted : value
  } catch {
    return safeFormatXml(value)
  }
}

export function SoapHistoryTable({ data, meta }: SoapHistoryTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [executing, setExecuting] = useState<string | null>(null)
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; log: SoapLogRow | null }>({ open: false, log: null })
  const [fullscreen, setFullscreen] = useState(false)

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  async function handleReexecute(log: SoapLog) {
    setExecuting(log.id)
    try {
      const result = await reexecuteSoapLog(log.id)
      if (result.success) {
        toast.success("Reexecução concluída")
        router.refresh()
      } else {
        toast.error(result.error || "Erro na reexecução")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na reexecução")
    }
    setExecuting(null)
  }

  const columns: ColumnDef<SoapLogRow>[] = [
    {
      accessorKey: "dataserver",
      header: "Endpoint (TBC)",
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("dataserver") || "-"}</span>,
    },
    {
      accessorKey: "process",
      header: "Serviço",
      cell: ({ row }) => row.getValue("process") || "-",
    },
    {
      accessorKey: "method",
      header: "Método",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("method") as string}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as number
        return (
          <Badge variant={status && status < 400 ? "default" : "destructive"}>
            {status || "Erro"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "duration",
      header: "Duração",
      cell: ({ row }) => {
        const duration = row.getValue("duration") as number
        return duration ? formatDuration(duration) : "-"
      },
    },
    {
      accessorKey: "error",
      header: "Erro",
      cell: ({ row }) => {
        const error = row.getValue("error") as string
        return error ? <span className="text-destructive text-sm truncate max-w-[200px] block">{error}</span> : "-"
      },
    },
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => formatDate(row.getValue("createdAt") as Date),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailDialog({ open: true, log: row.original })}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={executing === row.original.id}
            onClick={() => handleReexecute(row.original)}
            title="Reexecutar"
          >
            <RotateCcw className={`h-4 w-4 ${executing === row.original.id ? "animate-spin" : ""}`} />
          </Button>
        </div>
      ),
    },
  ]

  const detail = detailDialog.log

  return (
    <>
      <PageHeader title="Histórico SOAP" description="Chamadas SOAP realizadas — clique em um registro para ver todos os detalhes" />
      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por dataserver ou processo..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        onRowClick={(log) => setDetailDialog({ open: true, log })}
      />

      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => {
          setDetailDialog({ open, log: open ? detailDialog.log : null })
          if (!open) setFullscreen(false)
        }}
      >
        <DialogContent
          className={cn(
            "transition-[width,height]",
            fullscreen
              ? "h-[100vh]! max-h-[100vh]! w-[100vw]! max-w-[100vw]! rounded-none!"
              : "h-[70vh]! max-h-[70vh]! w-[70vw]! max-w-[70vw]!"
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Detalhes da chamada SOAP
              {detail && <Badge variant="outline">{detail.method}</Badge>}
              {detail && (
                <Badge variant={detail.status && detail.status < 400 ? "default" : "destructive"}>
                  {detail.status || "Erro"}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                onClick={() => setFullscreen((v) => !v)}
                title={fullscreen ? "Restaurar tamanho" : "Maximizar"}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <DialogBody>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Endpoint (TBC)</p>
                  <p className="font-mono text-xs break-all">{detail.dataserver || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Serviço</p>
                  <p>{detail.process || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p>{detail.duration ? formatDuration(detail.duration) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p>{detail.user?.name || "Sistema"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{formatDate(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID do registro</p>
                  <p className="font-mono text-xs break-all">{detail.id}</p>
                </div>
              </div>

              {detail.error && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Erro</p>
                  <pre className="whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {detail.error}
                  </pre>
                </div>
              )}

              {detail.context !== null && detail.context !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contexto</p>
                  <CodeEditor
                    value={JSON.stringify(detail.context, null, 2)}
                    language="json"
                    readOnly
                    theme="dark"
                    resetKey={detail.id}
                    minHeight={fullscreen ? "30vh" : "160px"}
                  />
                </div>
              )}

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">XML Requisição</TabsTrigger>
                  <TabsTrigger value="response-xml">XML Resposta</TabsTrigger>
                  <TabsTrigger value="response-json">JSON Resposta</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  {detail.xmlRequest ? (
                    <CodeEditor
                      value={safeFormatXml(detail.xmlRequest)}
                      language="xml"
                      readOnly
                      theme="dark"
                      resetKey={`${detail.id}-request`}
                      minHeight={fullscreen ? "45vh" : "260px"}
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">Sem XML de requisição registrado.</p>
                  )}
                </TabsContent>
                <TabsContent value="response-xml">
                  {detail.xmlResponse ? (
                    <CodeEditor
                      value={safeFormatXmlDeep(detail.xmlResponse)}
                      language="xml"
                      readOnly
                      theme="dark"
                      resetKey={`${detail.id}-response-xml`}
                      minHeight={fullscreen ? "45vh" : "260px"}
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">Sem XML de resposta registrado.</p>
                  )}
                </TabsContent>
                <TabsContent value="response-json">
                  {detail.jsonResponse ? (
                    <CodeEditor
                      value={JSON.stringify(detail.jsonResponse, null, 2)}
                      language="json"
                      readOnly
                      theme="dark"
                      resetKey={`${detail.id}-response-json`}
                      minHeight={fullscreen ? "45vh" : "260px"}
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">Sem JSON de resposta registrado.</p>
                  )}
                </TabsContent>
              </Tabs>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
