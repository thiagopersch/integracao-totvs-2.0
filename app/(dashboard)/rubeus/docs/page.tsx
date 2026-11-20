"use client"

import { fetchStageDocumentation, listSelectiveProcessStages } from "@/actions/integrations/ps-docs"
import { fetchPortalOverview, listPortalSelectiveProcesses } from "@/actions/integrations/ps-portal-docs"
import { CredentialsFormFields } from "@/components/ps-docs/credentials-form-fields"
import { DocOptionsPanel, docOptionsSummary } from "@/components/ps-docs/doc-options-panel"
import { PortalOverviewPreview } from "@/components/ps-docs/portal-overview-preview"
import { ProcessDocResult } from "@/components/ps-docs/process-doc-result"
import { StylePanel } from "@/components/ps-docs/style-panel"
import { CollapsibleCardHeader } from "@/components/shared/collapsible-card-header"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { parseCookieString, type PsCredentials } from "@/lib/ps-docs/credential"
import {
  DEFAULT_DOC_OPTIONS,
  DEFAULT_STYLE,
  type DocOptions,
  type DocumentacaoPS,
  type PortalOverviewSpec,
  type PortalProcessDocState,
  type PortalProcessRef,
  type StyleConfig,
} from "@/lib/ps-docs/types"
import { psDocsSchema, type PsDocsFormInput } from "@/schemas/ps-docs.schema"
import { zodResolver } from "@hookform/resolvers/zod"
import Chip from "@mui/material/Chip"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import { AlertCircle, CheckCircle2, FileText, Globe, Info, Loader2, Sparkles, Workflow } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { toast } from "@/lib/toast"

type DocMode = "processo" | "portal"

export default function PsDocsPage() {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<PsDocsFormInput>({
    mode: "onChange",
    resolver: zodResolver(psDocsSchema) as Resolver<PsDocsFormInput>,
    defaultValues: {
      docMode: "processo",
      cookie: "",
      idPs: "",
      crmDomain: "",
      idPortal: "",
      localId: "2",
    },
  })
  const docMode = useWatch({ control, name: "docMode" }) as DocMode
  const idPsValue = useWatch({ control, name: "idPs" })
  const idPortalValue = useWatch({ control, name: "idPortal" })
  const [style, setStyle] = useState<StyleConfig>(DEFAULT_STYLE)
  // "Conteúdo da documentação": the detail flags only affect rendering (preview + exports), so they
  // apply instantly even after generating; `escopoPortal` is read when the portal is submitted.
  const [docOptions, setDocOptions] = useState<DocOptions>(DEFAULT_DOC_OPTIONS)
  // The parameters form starts open and collapses once the documentation renders, so the result
  // gets the room; the user can reopen it from the header.
  const [formOpen, setFormOpen] = useState(true)
  const [processesOpen, setProcessesOpen] = useState(true)

  // Modo "processo seletivo específico" — inalterado em relação ao comportamento anterior.
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [model, setModel] = useState<DocumentacaoPS | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Modo "portal inteiro".
  const [portalSubmitting, setPortalSubmitting] = useState(false)
  const [portalOverviewLoading, setPortalOverviewLoading] = useState(false)
  const [portalOverview, setPortalOverview] = useState<PortalOverviewSpec | null>(null)
  const [processDocs, setProcessDocs] = useState<PortalProcessDocState[]>([])

  function updateProcessDoc(
    id: string,
    patch: Partial<PortalProcessDocState> | ((prev: PortalProcessDocState) => Partial<PortalProcessDocState>)
  ) {
    setProcessDocs((prev) =>
      prev.map((p) => (p.ref.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch) } : p))
    )
  }

  const toCredentials = (d: PsDocsFormInput): PsCredentials => parseCookieString(d.cookie)

  async function handleSubmitProcesso(data: PsDocsFormInput) {
    const credentials = toCredentials(data)
    const idPs = data.idPs
    const crmDomain = data.crmDomain

    setLoading(true)
    setError(null)
    setWarnings([])
    setModel(null)
    setProgress(null)

    try {
      const listRes = await listSelectiveProcessStages({ credentials, idPs, crmDomain: crmDomain.trim() || undefined })
      if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
        setError(listRes.error || "Erro ao consultar o processo seletivo")
        toast.error(listRes.error || "Erro ao consultar o processo seletivo")
        return
      }

      // Etapas aparecem uma a uma conforme chegam, em vez de esperar o processo inteiro.
      setModel({
        tituloPortal: listRes.tituloPortal ?? `Processo Seletivo ${idPs}`,
        idPs: listRes.idPs ?? idPs,
        etapas: [],
      })
      setProgress({ done: 0, total: listRes.stages.length })

      const allWarnings: string[] = [...(listRes.catalogWarnings ?? [])]
      for (const stage of listRes.stages) {
        const stageRes = await fetchStageDocumentation({
          credentials,
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
      setFormOpen(false)
      toast.success("Documentação gerada com sucesso")
      if (allWarnings.length > 0)
        toast.warning(`${allWarnings.length} aviso(s) durante a leitura da estrutura — confira o resultado.`)
    } finally {
      setLoading(false)
    }
  }

  /** Gera a documentação de UM processo seletivo do portal — chamada em paralelo para todos os
   *  processos ativos, cada uma atualizando só a própria entrada de `processDocs` conforme
   *  progride, para que o usuário não precise esperar todas terminarem para ver as primeiras. */
  async function generateOneProcessDoc(ref: PortalProcessRef, credentials: PsCredentials, crmDomain: string) {
    updateProcessDoc(ref.id, { status: "loading" })
    try {
      const listRes = await listSelectiveProcessStages({
        credentials,
        idPs: ref.id,
        crmDomain: crmDomain.trim() || undefined,
      })
      if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
        updateProcessDoc(ref.id, { status: "error", error: listRes.error || "Erro ao consultar o processo seletivo" })
        return
      }

      let doc: DocumentacaoPS = {
        tituloPortal: listRes.tituloPortal ?? ref.name,
        idPs: listRes.idPs ?? ref.id,
        etapas: [],
      }
      updateProcessDoc(ref.id, { doc, progress: { done: 0, total: listRes.stages.length } })

      const allWarnings: string[] = [...(listRes.catalogWarnings ?? [])]
      for (const stage of listRes.stages) {
        const stageRes = await fetchStageDocumentation({
          credentials,
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
        updateProcessDoc(ref.id, (prev) => ({
          doc,
          progress: prev.progress ? { done: prev.progress.done + 1, total: prev.progress.total } : undefined,
        }))
      }

      updateProcessDoc(ref.id, { status: "done", doc, warnings: allWarnings })
    } catch (e) {
      updateProcessDoc(ref.id, { status: "error", error: (e as Error).message })
    }
  }

  async function handleSubmitPortal(data: PsDocsFormInput) {
    const credentials = toCredentials(data)
    const { idPortal, localId, crmDomain } = data

    setPortalSubmitting(true)
    setPortalOverviewLoading(true)
    setPortalOverview(null)
    setProcessDocs([])

    try {
      // "Apenas o portal": only the portal configuration — the selective processes aren't even listed.
      if (docOptions.escopoPortal === "portal") {
        const overviewRes = await fetchPortalOverview({ credentials, idPortal, localId })
        setPortalOverviewLoading(false)
        if (overviewRes.success && overviewRes.overview) {
          setPortalOverview(overviewRes.overview)
          setFormOpen(false)
          toast.success("Documentação do portal gerada com sucesso")
        } else toast.error(overviewRes.error || "Erro ao consultar os dados gerais do portal")
        return
      }

      const [overviewRes, listRes] = await Promise.all([
        fetchPortalOverview({ credentials, idPortal, localId }),
        listPortalSelectiveProcesses({ credentials, idPortal }),
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

      const initial: PortalProcessDocState[] = listRes.processes.map((ref) => ({
        ref,
        status: "pending",
        warnings: [],
      }))
      setProcessDocs(initial)
      setProcessesOpen(true)
      // Each process reports its own progress in the list below, so the form can step aside now.
      setFormOpen(false)
      toast.success(`Gerando a documentação de ${initial.length} processo(s) seletivo(s)...`)

      // Dispara a geração de cada processo em paralelo, sem aguardar aqui — cada uma atualiza sua
      // própria aba conforme progride.
      for (const ref of listRes.processes) void generateOneProcessDoc(ref, credentials, crmDomain)
    } finally {
      setPortalSubmitting(false)
    }
  }

  // A Estilização só aparece depois que o usuário pede para gerar a documentação.
  const showStylePanel =
    docMode === "processo"
      ? loading || !!model || !!error
      : portalSubmitting || portalOverviewLoading || !!portalOverview || processDocs.length > 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" /> Gerar documentação
        </h1>
        <p className="text-sm text-muted-foreground">
          Lê a estrutura completa de um processo seletivo (etapas, passos, campos, componentes, ações TOTVS/Rubeus e
          feedbacks) ou de um portal inteiro a partir da sessão do portal admin, e gera a documentação técnica no padrão
          do mapeamento de ficha.
        </p>
      </div>

      <Card>
        <CollapsibleCardHeader
          title="Parâmetros da documentação"
          open={formOpen}
          onToggle={() => setFormOpen((open) => !open)}
          controlsId="ps-docs-form"
          expandLabel="Expandir parâmetros"
          collapseLabel="Recolher parâmetros"
          summary={[
            docMode === "portal" ? `Portal inteiro · ${idPortalValue || "—"}` : `Processo seletivo · ${idPsValue || "—"}`,
            docOptionsSummary(docOptions, docMode === "portal"),
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <CardContent id="ps-docs-form" hidden={!formOpen}>
          <form
            onSubmit={handleSubmit((d) => (d.docMode === "processo" ? handleSubmitProcesso(d) : handleSubmitPortal(d)))}
            className="space-y-4"
            noValidate
          >
            <Field>
              <FieldLabel>
                Deseja realizar a documentação de um processo seletivo específico ou do portal inteiro?
              </FieldLabel>
              <ToggleButtonGroup
                exclusive
                color="primary"
                value={docMode}
                onChange={(_e, v: DocMode | null) => v && setValue("docMode", v, { shouldValidate: true })}
                aria-label="Tipo de documentação"
                sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { gap: 1, px: 2, textTransform: "none" } }}
              >
                <ToggleButton value="processo">
                  <Workflow className="h-4 w-4" /> Processo seletivo específico
                </ToggleButton>
                <ToggleButton value="portal">
                  <Globe className="h-4 w-4" /> Portal inteiro
                </ToggleButton>
              </ToggleButtonGroup>
            </Field>

            <DocOptionsPanel value={docOptions} onChange={setDocOptions} showScope={docMode === "portal"} />

            <div className="space-y-4">
              <CredentialsFormFields control={control} errors={errors} />

              {docMode === "processo" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="idPs">ID do Processo Seletivo no I&M</FieldLabel>
                    <Input
                      id="idPs"
                      inputMode="numeric"
                      {...register("idPs")}
                      placeholder="Ex: 5537"
                      aria-invalid={!!errors.idPs}
                    />
                    <FieldError errors={[errors.idPs]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="crmDomain">Link do CRM</FieldLabel>
                    <Input
                      id="crmDomain"
                      {...register("crmDomain")}
                      placeholder="Ex: https://crmtoledo.apprubeus.com.br/"
                      aria-invalid={!!errors.crmDomain}
                    />
                    <FieldError errors={[errors.crmDomain]} />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="idPortal">ID do portal no I&M</FieldLabel>
                    <Input
                      id="idPortal"
                      inputMode="numeric"
                      {...register("idPortal")}
                      placeholder="Ex: 3734"
                      aria-invalid={!!errors.idPortal}
                    />
                    <FieldError errors={[errors.idPortal]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="crmDomainPortal">Link do CRM</FieldLabel>
                    <Input
                      id="crmDomainPortal"
                      {...register("crmDomain")}
                      placeholder="Ex: https://crmtoledo.apprubeus.com.br/"
                      aria-invalid={!!errors.crmDomain}
                    />
                    <FieldError errors={[errors.crmDomain]} />
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
                    <Input
                      id="localId"
                      inputMode="numeric"
                      {...register("localId")}
                      placeholder="2"
                      aria-invalid={!!errors.localId}
                    />
                    <FieldError errors={[errors.localId]} />
                  </Field>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <Button
                type="submit"
                size="lg"
                disabled={!isValid || (docMode === "processo" ? loading : portalSubmitting)}
                sx={{ px: 4, borderRadius: 6 }}
              >
                {(docMode === "processo" ? loading : portalSubmitting) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
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

      {showStylePanel && <StylePanel style={style} onChange={setStyle} />}

      {docMode === "processo" && model && <ProcessDocResult model={model} warnings={warnings} style={style} options={docOptions} />}

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

      {docMode === "portal" && !portalOverviewLoading && portalOverview && (
        <PortalOverviewPreview overview={portalOverview} style={style} options={docOptions} />
      )}

      {docMode === "portal" && processDocs.length > 0 && (
        <Card>
          <CollapsibleCardHeader
            title={`Processos seletivos do portal (${processDocs.length})`}
            open={processesOpen}
            onToggle={() => setProcessesOpen((open) => !open)}
            controlsId="ps-docs-processes"
            expandLabel="Expandir processos"
            collapseLabel="Recolher processos"
          />
          <CardContent id="ps-docs-processes" hidden={!processesOpen}>
            <Accordion defaultValue={[processDocs[0].ref.id]}>
              {processDocs.map((p) => (
                <AccordionItem key={p.ref.id} value={p.ref.id}>
                  <AccordionTrigger className="gap-1.5">
                    <span className="flex flex-1 flex-wrap items-center gap-2">
                      <span>
                        {p.ref.identifier} | {p.ref.name}
                      </span>
                      <ProcessStatusChip doc={p} />
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
                      <p className="text-sm text-destructive">
                        {p.error ?? "Falha ao gerar a documentação deste processo."}
                      </p>
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
                        <ProcessDocResult model={p.doc} warnings={p.warnings} style={style} options={docOptions} />
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

/** Material status chip for one process of the "portal inteiro" list. */
function ProcessStatusChip({ doc }: { doc: PortalProcessDocState }) {
  switch (doc.status) {
    case "pending":
      return <Chip variant="outlined" label="Na fila" icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />} />
    case "loading":
      return (
        <Chip
          color="info"
          variant="outlined"
          label={doc.progress ? `Gerando ${doc.progress.done}/${doc.progress.total}` : "Gerando"}
          icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
        />
      )
    case "done":
      return <Chip color="success" label="Concluído" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
    case "error":
      return <Chip color="error" label="Erro" icon={<AlertCircle className="h-3.5 w-3.5" />} />
  }
}
