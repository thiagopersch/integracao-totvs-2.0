"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, BookmarkPlus, Download, FileJson, Loader2, MoreVertical, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { renameMapeadorProjeto, importMapeadorProjeto } from "@/actions/mapeador"
import { createMapeadorTemplateModelo } from "@/actions/mapeador-template"
import { exportMapeadorProjetoJson, exportMapeadorProjetoXlsx } from "@/actions/mapeador-export"
import { useMapeadorStore } from "@/store/mapeador.store"
import { useDebounce } from "@/hooks/use-debounce"
import { useRouter } from "next/navigation"
import type { MapeadorProjetoDTO } from "@/types/mapeador"
import { MapeamentoTab } from "@/components/mapeador/mapeamento-tab"
import { InformacoesAdicionaisTab } from "@/components/mapeador/informacoes-adicionais-tab"
import { VisualizadorTab } from "@/components/mapeador/visualizador-tab"
import { PrototipoTab } from "@/components/mapeador/prototipo-tab"

function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function downloadText(text: string, fileName: string) {
  const blob = new Blob([text], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

interface MapeadorClientProps {
  initialProjeto: MapeadorProjetoDTO
}

export function MapeadorClient({ initialProjeto }: MapeadorClientProps) {
  const router = useRouter()
  const hydrate = useMapeadorStore((s) => s.hydrate)
  const projeto = useMapeadorStore((s) => s.projeto)
  const activeTab = useMapeadorStore((s) => s.activeTab)
  const setActiveTab = useMapeadorStore((s) => s.setActiveTab)
  const setNome = useMapeadorStore((s) => s.setNome)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState<"json" | "xlsx" | null>(null)
  const [saveModeloOpen, setSaveModeloOpen] = useState(false)
  const [modeloNome, setModeloNome] = useState("")
  const [savingModelo, setSavingModelo] = useState(false)

  useEffect(() => {
    hydrate(initialProjeto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjeto.id])

  const debouncedNome = useDebounce(projeto?.nome ?? "", 600)
  const firstRenameRun = useRef(true)
  useEffect(() => {
    if (firstRenameRun.current) {
      firstRenameRun.current = false
      return
    }
    if (debouncedNome.trim()) renameMapeadorProjeto(initialProjeto.id, debouncedNome.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNome])

  if (!projeto) return null

  async function handleExportJson() {
    setExporting("json")
    try {
      const result = await exportMapeadorProjetoJson(projeto!.id)
      if (!result.success) return toast.error(result.error || "Erro ao exportar JSON")
      downloadText(result.json, result.fileName)
    } finally {
      setExporting(null)
    }
  }

  async function handleExportXlsx() {
    setExporting("xlsx")
    try {
      const result = await exportMapeadorProjetoXlsx(projeto!.id)
      if (!result.success) return toast.error(result.error || "Erro ao exportar Excel")
      downloadBase64(result.base64, result.fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    } finally {
      setExporting(null)
    }
  }

  async function handleImport(file: File) {
    const text = await file.text()
    const result = await importMapeadorProjeto(text)
    if (!result.success) return toast.error(result.error || "Erro ao importar JSON")
    router.push(`/projetos/mapeador/${result.data.id}`)
  }

  async function handleSaveModelo() {
    if (!modeloNome.trim()) return
    setSavingModelo(true)
    try {
      const result = await createMapeadorTemplateModelo(projeto!.id, modeloNome)
      if (!result.success) return toast.error(result.error || "Erro ao salvar modelo")
      toast.success(`Modelo "${result.data.nome}" salvo — disponível ao criar um novo projeto`)
      setSaveModeloOpen(false)
      setModeloNome("")
    } finally {
      setSavingModelo(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex h-full flex-col">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/projetos/mapeador")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input
              value={projeto.nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-56 border-none text-lg font-bold shadow-none focus-visible:ring-1"
            />
            <TabsList>
              <TabsTrigger value="mapeamento">Mapeamento</TabsTrigger>
              <TabsTrigger value="informacoes">Informações adicionais</TabsTrigger>
              <TabsTrigger value="visualizador">Visualizador</TabsTrigger>
              <TabsTrigger value="prototipo">Protótipo visual</TabsTrigger>
            </TabsList>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              e.target.value = ""
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-auto min-w-44 whitespace-nowrap">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importar JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJson} disabled={exporting !== null}>
                {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />} Exportar JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXlsx} disabled={exporting !== null}>
                {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSaveModeloOpen(true)}>
                <BookmarkPlus className="h-4 w-4" /> Salvar como modelo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog open={saveModeloOpen} onOpenChange={setSaveModeloOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar como modelo</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="mb-2 text-sm text-muted-foreground">
                Salva a estrutura atual de etapas e campos como um modelo reutilizável, disponível ao criar um novo projeto.
              </p>
              <Input value={modeloNome} onChange={(e) => setModeloNome(e.target.value)} placeholder="Nome do modelo" autoFocus />
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveModeloOpen(false)} disabled={savingModelo}>
                Cancelar
              </Button>
              <Button onClick={handleSaveModelo} disabled={savingModelo || !modeloNome.trim()}>
                {savingModelo && <Loader2 className="h-4 w-4 animate-spin" />} Salvar modelo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="mapeamento" className="mt-0">
            <MapeamentoTab />
          </TabsContent>
          <TabsContent value="informacoes" className="mt-0">
            <InformacoesAdicionaisTab />
          </TabsContent>
          <TabsContent value="visualizador" className="mt-0">
            <VisualizadorTab />
          </TabsContent>
          <TabsContent value="prototipo" className="mt-0">
            <PrototipoTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
