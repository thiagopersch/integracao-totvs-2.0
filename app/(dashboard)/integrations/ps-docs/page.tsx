"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { ProcessDocResult } from "@/components/ps-docs/process-doc-result"
import { PortalOverviewPreview } from "@/components/ps-docs/portal-overview-preview"
import { FileText, Loader2, Info, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { listSelectiveProcessStages, fetchStageDocumentation } from "@/actions/integrations/ps-docs"
import { fetchPortalOverview, listPortalSelectiveProcesses } from "@/actions/integrations/ps-portal-docs"
import { DEFAULT_STYLE, type DocumentacaoPS, type PortalOverviewSpec, type PortalProcessDocState, type PortalProcessRef, type StyleConfig } from "@/lib/ps-docs/types"

type DocMode = "processo" | "portal"

export default function PsDocsPage() {
  const [docMode, setDocMode] = useState<DocMode>("processo")
  const [tokenPs, setTokenPs] = useState("")
  const [idPs, setIdPs] = useState("")
  const [crmDomain, setCrmDomain] = useState("")
  const [style, setStyle] = useState<StyleConfig>(DEFAULT_STYLE)

  // Modo "processo seletivo específico" — inalterado em relação ao comportamento anterior.
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [model, setModel] = useState<DocumentacaoPS | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Modo "portal inteiro".
  const [idPortal, setIdPortal] = useState("")
  const [localId, setLocalId] = useState("2")
  const [portalSubmitting, setPortalSubmitting] = useState(false)
  const [portalOverviewLoading, setPortalOverviewLoading] = useState(false)
  const [portalOverview, setPortalOverview] = useState<PortalOverviewSpec | null>(null)
  const [processDocs, setProcessDocs] = useState<PortalProcessDocState[]>([])

  function updateProcessDoc(id: string, patch: Partial<PortalProcessDocState> | ((prev: PortalProcessDocState) => Partial<PortalProcessDocState>)) {
    setProcessDocs((prev) => prev.map((p) => (p.ref.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch) } : p)))
  }

  async function handleSubmitProcesso(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenPs.trim() || !idPs.trim()) {
      toast.error("Informe o Token PS e o ID PS")
      return
    }

    setLoading(true)
    setError(null)
    setWarnings([])
    setModel(null)
    setProgress(null)

    try {
      const listRes = await listSelectiveProcessStages({ tokenPs, idPs, crmDomain: crmDomain.trim() || undefined })
      if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
        setError(listRes.error || "Erro ao consultar o processo seletivo")
        toast.error(listRes.error || "Erro ao consultar o processo seletivo")
        return
      }

      // Etapas aparecem uma a uma conforme chegam, em vez de esperar o processo inteiro.
      setModel({ tituloPortal: listRes.tituloPortal ?? `Processo Seletivo ${idPs}`, idPs: listRes.idPs ?? idPs, etapas: [] })
      setProgress({ done: 0, total: listRes.stages.length })

      const allWarnings: string[] = [...(listRes.catalogWarnings ?? [])]
      for (const stage of listRes.stages) {
        const stageRes = await fetchStageDocumentation({
          tokenPs,
          idPs,
          stage: stage.ref,
          fieldCatalogEntries: listRes.fieldCatalogEntries,
          actionCatalogEntries: listRes.actionCatalogEntries,
        })
        if (stageRes.success && stageRes.etapa) {
          setModel((prev) => (prev ? { ...prev, etapas: [...prev.etapas, stageRes.etapa!] } : prev))
          if (stageRes.warnings) allWarnings.push(...stageRes.warnings)
        } else {
          allWarnings.push(`Etapa "${stage.label}": ${stageRes.error ?? "falha ao consultar"}`)
        }
        setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
      }

      setWarnings(allWarnings)
      toast.success("Documentação gerada com sucesso")
      if (allWarnings.length > 0) toast.warning(`${allWarnings.length} aviso(s) durante a leitura da estrutura — confira o resultado.`)
    } finally {
      setLoading(false)
    }
  }

  /** Gera a documentação de UM processo seletivo do portal — chamada em paralelo para todos os
   *  processos ativos, cada uma atualizando só a própria entrada de `processDocs` conforme
   *  progride, para que o usuário não precise esperar todas terminarem para ver as primeiras. */
  async function generateOneProcessDoc(ref: PortalProcessRef) {
    updateProcessDoc(ref.id, { status: "loading" })
    try {
      const listRes = await listSelectiveProcessStages({ tokenPs, idPs: ref.id, crmDomain: crmDomain.trim() || undefined })
      if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
        updateProcessDoc(ref.id, { status: "error", error: listRes.error || "Erro ao consultar o processo seletivo" })
        return
      }

      let doc: DocumentacaoPS = { tituloPortal: listRes.tituloPortal ?? ref.name, idPs: listRes.idPs ?? ref.id, etapas: [] }
      updateProcessDoc(ref.id, { doc, progress: { done: 0, total: listRes.stages.length } })

      const allWarnings: string[] = [...(listRes.catalogWarnings ?? [])]
      for (const stage of listRes.stages) {
        const stageRes = await fetchStageDocumentation({
          tokenPs,
          idPs: ref.id,
          stage: stage.ref,
          fieldCatalogEntries: listRes.fieldCatalogEntries,
          actionCatalogEntries: listRes.actionCatalogEntries,
        })
        if (stageRes.success && stageRes.etapa) {
          doc = { ...doc, etapas: [...doc.etapas, stageRes.etapa] }
          if (stageRes.warnings) allWarnings.push(...stageRes.warnings)
        } else {
          allWarnings.push(`Etapa "${stage.label}": ${stageRes.error ?? "falha ao consultar"}`)
        }
        updateProcessDoc(ref.id, (prev) => ({ doc, progress: prev.progress ? { done: prev.progress.done + 1, total: prev.progress.total } : undefined }))
      }

      updateProcessDoc(ref.id, { status: "done", doc, warnings: allWarnings })
    } catch (e) {
      updateProcessDoc(ref.id, { status: "error", error: (e as Error).message })
    }
  }

  async function handleSubmitPortal(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenPs.trim() || !idPortal.trim() || !crmDomain.trim()) {
      toast.error("Informe o Token PS, o ID do Portal e o Link do CRM")
      return
    }

    setPortalSubmitting(true)
    setPortalOverviewLoading(true)
    setPortalOverview(null)
    setProcessDocs([])

    try {
      const [overviewRes, listRes] = await Promise.all([
        fetchPortalOverview({ tokenPs, idPortal, localId }),
        listPortalSelectiveProcesses({ tokenPs, idPortal }),
      ])

      if (overviewRes.success && overviewRes.overview) setPortalOverview(overviewRes.overview)
      else toast.error(overviewRes.error || "Erro ao consultar os dados gerais do portal")
      setPortalOverviewLoading(false)

      if (!listRes.success || !listRes.processes) {
        toast.error(listRes.error || "Erro ao listar os processos seletivos do portal")
        return
      }
      if (listRes.processes.length === 0) {
        toast.warning("Nenhum processo seletivo ativo encontrado no portal")
        return
      }

      const initial: PortalProcessDocState[] = listRes.processes.map((ref) => ({ ref, status: "pending", warnings: [] }))
      setProcessDocs(initial)
      toast.success(`Gerando a documentação de ${initial.length} processo(s) seletivo(s)...`)

      // Dispara a geração de cada processo em paralelo, sem aguardar aqui — cada uma atualiza sua
      // própria aba conforme progride.
      for (const ref of listRes.processes) void generateOneProcessDoc(ref)
    } finally {
      setPortalSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" /> Documentação PS
        </h1>
        <p className="text-sm text-muted-foreground">
          Lê a estrutura completa de um processo seletivo (etapas, passos, campos, componentes, ações TOTVS/Rubeus e
          feedbacks) ou de um portal inteiro a partir do Token PS, e gera a documentação técnica no padrão do
          mapeamento de ficha.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={docMode === "processo" ? handleSubmitProcesso : handleSubmitPortal} className="space-y-4">
            <Field>
              <FieldLabel>Deseja realizar a documentação de um processo seletivo específico ou do portal inteiro?</FieldLabel>
              <RadioGroup value={docMode} onValueChange={(v) => setDocMode(v as DocMode)} className="flex-row gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="processo" id="mode-processo" />
                  <Label htmlFor="mode-processo" className="font-normal cursor-pointer">
                    Processo seletivo específico
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="portal" id="mode-portal" />
                  <Label htmlFor="mode-portal" className="font-normal cursor-pointer">
                    Portal inteiro
                  </Label>
                </div>
              </RadioGroup>
            </Field>

            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="tokenPs">Token PS</FieldLabel>
                <PasswordInput id="tokenPs" value={tokenPs} onChange={setTokenPs} placeholder="Copiado do localStorage do portal admin" />
              </Field>

              {docMode === "processo" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="idPs">idPS do I&M</FieldLabel>
                    <Input id="idPs" value={idPs} onChange={(e) => setIdPs(e.target.value)} placeholder="Ex: 5537" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="crmDomain">Link do CRM (opcional)</FieldLabel>
                    <Input id="crmDomain" value={crmDomain} onChange={(e) => setCrmDomain(e.target.value)} placeholder="Ex: https://crmtoledo.apprubeus.com.br/" />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="idPortal">ID do Portal</FieldLabel>
                    <Input id="idPortal" value={idPortal} onChange={(e) => setIdPortal(e.target.value)} placeholder="Ex: 3734" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="crmDomainPortal">Link do CRM</FieldLabel>
                    <Input id="crmDomainPortal" value={crmDomain} onChange={(e) => setCrmDomain(e.target.value)} placeholder="Ex: https://crmtoledo.apprubeus.com.br/" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="localId" className="flex items-center gap-1.5">
                      Local ID
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button type="button" className="inline-flex" aria-label="Ajuda sobre o Local ID">
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          }
                        />
                        <TooltipContent>Necessário para a listagem das consultas do portal.</TooltipContent>
                      </Tooltip>
                    </FieldLabel>
                    <Input id="localId" value={localId} onChange={(e) => setLocalId(e.target.value)} placeholder="2" />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <Button type="submit" disabled={docMode === "processo" ? loading : portalSubmitting}>
                {(docMode === "processo" ? loading : portalSubmitting) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Gerar documentação
              </Button>
              {docMode === "processo" && loading && progress && (
                <div className="w-full max-w-xs space-y-1">
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                  <p className="text-xs text-muted-foreground text-center">
                    {progress.done}/{progress.total} etapa(s) processada(s)
                  </p>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {docMode === "processo" && model && <ProcessDocResult model={model} warnings={warnings} style={style} onStyleChange={setStyle} />}

      {docMode === "processo" && error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {docMode === "portal" && portalOverviewLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Consultando dados gerais do portal...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}

      {docMode === "portal" && !portalOverviewLoading && portalOverview && <PortalOverviewPreview overview={portalOverview} style={style} />}

      {docMode === "portal" && processDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Processos seletivos do portal</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion defaultValue={[processDocs[0].ref.id]}>
              {processDocs.map((p) => (
                <AccordionItem key={p.ref.id} value={p.ref.id}>
                  <AccordionTrigger className="gap-1.5">
                    <span className="flex flex-1 flex-wrap items-center gap-1.5">
                      {p.status === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {p.status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {p.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {p.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                      <span>
                        {p.ref.identifier} | {p.ref.name}
                      </span>
                      {p.status === "loading" && p.progress && (
                        <span className="text-xs text-muted-foreground">
                          ({p.progress.done}/{p.progress.total})
                        </span>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {p.status === "pending" && (
                      <div className="space-y-3">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-40 w-full" />
                      </div>
                    )}
                    {p.status === "error" && (
                      <p className="text-sm text-destructive">{p.error ?? "Falha ao gerar a documentação deste processo."}</p>
                    )}
                    {p.doc && (
                      <div className="space-y-3">
                        {p.status === "loading" && p.progress && (
                          <div className="max-w-xs space-y-1">
                            <Progress value={(p.progress.done / Math.max(p.progress.total, 1)) * 100} />
                            <p className="text-xs text-muted-foreground">
                              {p.progress.done}/{p.progress.total} etapa(s) processada(s)
                            </p>
                          </div>
                        )}
                        <ProcessDocResult model={p.doc} warnings={p.warnings} style={style} onStyleChange={setStyle} />
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
