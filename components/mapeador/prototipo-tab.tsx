"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Download, ExternalLink, FileText, Loader2, Pencil, Ruler } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateMapeadorPrototipoConfig, updateMapeadorEtapa, listMapeadorProjetos, getMapeadorProjeto } from "@/actions/mapeador"
import { exportMapeadorPrototipoHtml } from "@/actions/mapeador-export"
import { listMapeadorTemas } from "@/actions/mapeador-tema"
import { useMapeadorStore } from "@/store/mapeador.store"
import { cn } from "@/lib/utils"
import { ImageInput } from "@/components/mapeador/image-input"
import { PrototipoPreview } from "@/components/mapeador/prototipo/prototipo-preview"
import { PrototipoNavbar } from "@/components/mapeador/prototipo/prototipo-navbar"
import { TemaEditorDialog } from "@/components/mapeador/prototipo/tema-editor-dialog"
import { buildScreens } from "@/components/mapeador/prototipo/screens"
import { prototipoCss } from "@/components/mapeador/prototipo/styles"
import { exportPrototipoPdf } from "@/components/mapeador/prototipo/export-pdf"
import { updateCampoDeep, type MapeadorCampo, type MapeadorCampoLargura, type MapeadorGerarPara, type MapeadorProjetoDTO, type MapeadorTemaDTO } from "@/types/mapeador"

function isVoltarButton(label: string) {
  return /voltar/i.test(label)
}

function downloadText(text: string, fileName: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function PrototipoTab() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const patchPrototipoConfig = useMapeadorStore((s) => s.patchPrototipoConfig)
  const setCamposPorEtapa = useMapeadorStore((s) => s.setCamposPorEtapa)

  const config = projeto.prototipoConfig
  const gerarPara: MapeadorGerarPara = config.gerarPara ?? "atual"
  const exportVisualizacao = config.exportVisualizacao ?? "desktop"

  const [temas, setTemas] = useState<MapeadorTemaDTO[]>([])
  // The org's editable baseline appearance (auto-created server-side) — kept out of the "Tema"
  // dropdown's own list (it already has a "Padrão" option meaning "no tema applied") and instead
  // used as the fallback wherever a color hasn't been set, plus as the target of the edit button
  // next to that dropdown when nothing else is selected.
  const temaPadrao = temas.find((t) => t.nome === "Padrão") ?? null
  const temasSelecionaveis = temas.filter((t) => t.id !== temaPadrao?.id)
  const temaAtivo = config.temaId ? (temas.find((t) => t.id === config.temaId) ?? null) : temaPadrao
  const [temaDialogOpen, setTemaDialogOpen] = useState(false)
  const [editingTema, setEditingTema] = useState<MapeadorTemaDTO | null>(null)
  const [siblingProjetos, setSiblingProjetos] = useState<MapeadorProjetoDTO[] | null>(null)
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  const [adjustMode, setAdjustMode] = useState(false)
  const [editingTextos, setEditingTextos] = useState(false)
  const [screenIndex, setScreenIndex] = useState(0)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [exporting, setExporting] = useState<"html" | "pdf" | null>(null)

  useEffect(() => {
    listMapeadorTemas().then(setTemas)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setScreenIndex(0)
      if (gerarPara !== "todos") {
        setSiblingProjetos(null)
        return
      }
      setLoadingSiblings(true)
      const summaries = await listMapeadorProjetos()
      const all = await Promise.all(summaries.map((s) => getMapeadorProjeto(s.id)))
      if (cancelled) return
      setSiblingProjetos(all.filter((p): p is MapeadorProjetoDTO => !!p))
      setLoadingSiblings(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [gerarPara])

  const projetos = useMemo(() => {
    if (gerarPara === "todos" && siblingProjetos) {
      // Keep the currently-edited project's live (unsaved-to-disk-yet) state in sync in the list.
      return siblingProjetos.map((p) => (p.id === projeto.id ? projeto : p))
    }
    return [projeto]
  }, [gerarPara, siblingProjetos, projeto])

  const screens = useMemo(() => buildScreens(projetos), [projetos])

  const screen = screens[Math.min(screenIndex, screens.length - 1)]

  function saveConfig(patch: Partial<typeof config>) {
    patchPrototipoConfig(patch)
    updateMapeadorPrototipoConfig(projeto.id, { ...config, ...patch }).then((result) => {
      if (!result.success) toast.error(result.error || "Erro ao salvar configuração do protótipo")
    })
  }

  function setValue(campoId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [campoId]: value }))
  }

  function goTo(index: number) {
    setScreenIndex(Math.max(0, Math.min(screens.length - 1, index)))
  }

  function handleBotaoClick(campo: MapeadorCampo) {
    if (isVoltarButton(campo.label)) return goTo(screenIndex - 1)
    // Required fields are highlighted (via `largura`/`obrigatorio`) but never block navigation.
    goTo(screenIndex + 1)
  }

  function handleLarguraChange(campoId: string, largura: MapeadorCampoLargura) {
    if (screen.kind !== "form" || screen.projetoIndex !== projetos.indexOf(projeto)) return
    const etapa = projeto.etapas[screen.etapaIndex]
    if (!etapa) return
    const nextCampos = etapa.camposPorEtapa.map((passo) => ({
      ...passo,
      campos: updateCampoDeep(passo.campos, campoId, { largura }),
    }))
    setCamposPorEtapa(etapa.id, nextCampos)
    updateMapeadorEtapa(etapa.id, projeto.id, { camposPorEtapa: nextCampos }).then((result) => {
      if (!result.success) toast.error(result.error || "Erro ao salvar largura do campo")
    })
  }

  function handleNovaLinhaChange(campoId: string, novaLinha: boolean) {
    if (screen.kind !== "form" || screen.projetoIndex !== projetos.indexOf(projeto)) return
    const etapa = projeto.etapas[screen.etapaIndex]
    if (!etapa) return
    const nextCampos = etapa.camposPorEtapa.map((passo) => ({
      ...passo,
      campos: updateCampoDeep(passo.campos, campoId, { novaLinha }),
    }))
    setCamposPorEtapa(etapa.id, nextCampos)
    updateMapeadorEtapa(etapa.id, projeto.id, { camposPorEtapa: nextCampos }).then((result) => {
      if (!result.success) toast.error(result.error || "Erro ao salvar layout do campo")
    })
  }

  function handleTextoChange(id: string, value: string) {
    saveConfig({ textos: { ...(config.textos ?? {}), [id]: value } })
  }

  async function handleExportHtml() {
    setExporting("html")
    try {
      const result = await exportMapeadorPrototipoHtml(projeto.id, gerarPara)
      if (!result.success) return toast.error(result.error || "Erro ao gerar HTML")
      downloadText(result.html, result.fileName, "text/html")
    } finally {
      setExporting(null)
    }
  }

  async function handleExportPdf() {
    setExporting("pdf")
    try {
      exportPrototipoPdf(projetos, exportVisualizacao === "mobile" ? "portrait" : "landscape")
    } finally {
      setExporting(null)
    }
  }

  function handleOpenNewTab() {
    window.open(`/projetos/mapeador/${projeto.id}/prototipo/preview?gerarPara=${gerarPara}`, "_blank")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 py-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Conteúdo</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Gerar para</Label>
                <Select
                  items={[
                    { value: "atual", label: "Somente este processo" },
                    { value: "todos", label: "Todos os processos" },
                  ]}
                  value={gerarPara}
                  onValueChange={(v) => saveConfig({ gerarPara: v as MapeadorGerarPara })}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atual">Somente este processo</SelectItem>
                    <SelectItem value="todos">Todos os processos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Visualização</Label>
                <div className="flex overflow-hidden rounded-md border">
                  <button
                    className={cn("px-3 py-1 text-sm", (config.visualizacao ?? "desktop") === "desktop" ? "bg-primary text-primary-foreground" : "bg-background")}
                    onClick={() => saveConfig({ visualizacao: "desktop" })}
                  >
                    Desktop
                  </button>
                  <button
                    className={cn("px-3 py-1 text-sm", config.visualizacao === "mobile" ? "bg-primary text-primary-foreground" : "bg-background")}
                    onClick={() => saveConfig({ visualizacao: "mobile" })}
                  >
                    Mobile
                  </button>
                </div>
              </div>
              <Button
                variant={adjustMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setAdjustMode((v) => !v)
                  setEditingTextos(false)
                }}
              >
                <Ruler className="h-4 w-4" /> Ajustar layout
              </Button>
              <Button
                variant={editingTextos ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setEditingTextos((v) => !v)
                  setAdjustMode(false)
                }}
              >
                <Pencil className="h-4 w-4" /> Editar textos
              </Button>
            </div>
            {(adjustMode || editingTextos) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {adjustMode
                  ? "Modo de ajuste ativo: clique em um campo na prévia abaixo e escolha a largura, de 1 a 12 colunas (12 = linha inteira)."
                  : 'Modo de edição de texto ativo: clique em um texto fixo da prévia (ex. "AVANÇAR", título do Portal do candidato) para reescrevê-lo.'}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Aparência</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tema</Label>
                <div className="flex items-center gap-1">
                  <Select
                    items={[{ value: "__none__", label: "Padrão" }, ...temasSelecionaveis.map((t) => ({ value: t.id, label: t.nome })), { value: "__new__", label: "+ Criar novo tema" }]}
                    value={config.temaId ?? "__none__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setEditingTema(null)
                        setTemaDialogOpen(true)
                        return
                      }
                      const temaId = v === "__none__" ? null : (v as string)
                      const tema = temas.find((t) => t.id === temaId)
                      saveConfig({
                        temaId,
                        ...(tema
                          ? {
                              corMarca: tema.config.corMarca,
                              corBarra: tema.config.corBarra,
                              logoUrl: tema.config.logoUrl,
                              bgImageUrl: tema.config.bgImageUrl,
                            }
                          : {}),
                      })
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Padrão</SelectItem>
                      {temasSelecionaveis.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Criar novo tema</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!temaAtivo}
                    title="Editar tema atual"
                    onClick={() => {
                      setEditingTema(temaAtivo)
                      setTemaDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor da marca</Label>
                <Input type="color" value={config.corMarca || temaPadrao?.config.corMarca || "#0CC1AA"} onChange={(e) => saveConfig({ corMarca: e.target.value })} className="h-8 w-14 p-1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cor da barra</Label>
                <Input type="color" value={config.corBarra || temaPadrao?.config.corBarra || "#0AA392"} onChange={(e) => saveConfig({ corBarra: e.target.value })} className="h-8 w-14 p-1" />
              </div>
              <ImageInput label="Logo" value={config.logoUrl} onChange={(url) => saveConfig({ logoUrl: url })} kind="logo" />
              <ImageInput label="Imagem de fundo" value={config.bgImageUrl} onChange={(url) => saveConfig({ bgImageUrl: url })} hint="Recomendado: pelo menos 1600×1000px, paisagem" kind="background" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Exportar</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select items={[{ value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }]} value={exportVisualizacao} onValueChange={(v) => saveConfig({ exportVisualizacao: v as "desktop" | "mobile" })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleOpenNewTab}>
                <ExternalLink className="h-4 w-4" /> Abrir em nova aba
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null}>
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Exportar PDF
              </Button>
              <Button size="sm" onClick={handleExportHtml} disabled={exporting !== null}>
                {exporting === "html" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar .html
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingSiblings ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex justify-center">
          <div
            className={cn("mapeador-proto overflow-hidden rounded-lg border shadow-sm transition-all", config.visualizacao === "mobile" ? "w-[390px]" : "w-full")}
            data-visualizacao={config.visualizacao ?? "desktop"}
            style={
              {
                "--brand": config.corMarca || temaPadrao?.config.corMarca || "#0CC1AA",
                "--bar": config.corBarra || temaPadrao?.config.corBarra || "#0AA392",
              } as React.CSSProperties
            }
          >
            <style dangerouslySetInnerHTML={{ __html: prototipoCss(".mapeador-proto") }} />
            <PrototipoPreview
              screen={screen}
              projetos={projetos}
              values={values}
              errors={new Set()}
              setValue={setValue}
              onBotaoClick={handleBotaoClick}
              onAdvanceFromPortal={() => goTo(screenIndex + 1)}
              logoUrl={config.logoUrl}
              bgImageUrl={config.bgImageUrl}
              textos={config.textos ?? {}}
              onTextoChange={handleTextoChange}
              editingTextos={editingTextos}
              adjustMode={adjustMode}
              onLarguraChange={handleLarguraChange}
              onNovaLinhaChange={handleNovaLinhaChange}
            />
            <PrototipoNavbar screens={screens} screenIndex={screenIndex} projetos={projetos} onJump={goTo} />
          </div>
        </div>
      )}

      <TemaEditorDialog
        open={temaDialogOpen}
        onOpenChange={setTemaDialogOpen}
        tema={editingTema}
        onSaved={(tema) => {
          setTemas((prev) => {
            const exists = prev.some((t) => t.id === tema.id)
            return exists ? prev.map((t) => (t.id === tema.id ? tema : t)) : [...prev, tema]
          })
          // Editing the "Padrão" tema while the project still has no tema explicitly chosen must
          // NOT set `temaId` — Padrão is excluded from the selectable list, so that id wouldn't
          // match any option — and the color fallbacks already read `temaPadrao.config` live, so
          // the edit takes effect immediately without copying anything into this project's config.
          if (tema.nome === "Padrão" && !config.temaId) return
          saveConfig({ temaId: tema.id, corMarca: tema.config.corMarca, corBarra: tema.config.corBarra, logoUrl: tema.config.logoUrl, bgImageUrl: tema.config.bgImageUrl })
        }}
      />
    </div>
  )
}
