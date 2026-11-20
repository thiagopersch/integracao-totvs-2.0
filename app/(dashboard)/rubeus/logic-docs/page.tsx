"use client"

import { fetchStageDocumentation, listSelectiveProcessStages } from "@/actions/integrations/ps-docs"
import { fetchPortalOverview, listPortalSelectiveProcesses } from "@/actions/integrations/ps-portal-docs"
import { CredentialsFormFields } from "@/components/ps-docs/credentials-form-fields"
import { LogicTrailResult } from "@/components/ps-docs/logic-trail-result"
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
import { extractLogicTrails, extractPortalLogicTrails } from "@/lib/ps-docs/logic-trail"
import { parseCookieString, type PsCredentials } from "@/lib/ps-docs/credential"
import {
  DEFAULT_STYLE,
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
import { AlertCircle, CheckCircle2, GitBranch, Globe, Info, Loader2, Sparkles, Workflow } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { toast } from "@/lib/toast"

type DocMode = "processo" | "portal"
type EscopoPortal = "portal" | "tudo"

export default function PsLogicDocsPage() {
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
  const [escopoPortal, setEscopoPortal] = useState<EscopoPortal>("tudo")
  const [formOpen, setFormOpen] = useState(true)
  const [processesOpen, setProcessesOpen] = useState(true)

  // Modo "processo seletivo específico".
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [model, setModel] = useState<DocumentacaoPS | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const logicDoc = useMemo(() => (model ? extractLogicTrails(model) : null), [model])

  // Modo "portal inteiro".
  const [portalSubmitting, setPortalSubmitting] = useState(false)
  const [portalOverviewLoading, setPortalOverviewLoading] = useState(false)
  const [portalOverview, setPortalOverview] = useState<PortalOverviewSpec | null>(null)
  const [processDocs, setProcessDocs] = useState<PortalProcessDocState[]>([])
  const portalLogicDoc = useMemo(
    () =>
      portalOverview
        ? { tituloPortal: portalOverview.geral.nome, idPs: portalOverview.idPortal, trilhas: extractPortalLogicTrails(portalOverview) }
        : null,
    [portalOverview]
  )

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
      toast.success("Trilhas de lógica geradas com sucesso")
      if (allWarnings.length > 0)
        toast.warning(`${allWarnings.length} aviso(s) durante a leitura da estrutura — confira o resultado.`)
    } finally {
      setLoading(false)
    }
  }

  /** Gera as trilhas de UM processo seletivo do portal — chamada em paralelo para todos os
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
      if (escopoPortal === "portal") {
        const overviewRes = await fetchPortalOverview({ credentials, idPortal, localId })
        setPortalOverviewLoading(false)
        if (overviewRes.success && overviewRes.overview) {
          setPortalOverview(overviewRes.overview)
          setFormOpen(false)
          toast.success("Trilhas de lógica do portal geradas com sucesso")
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
      setFormOpen(false)
      toast.success(`Gerando as trilhas de lógica de ${initial.length} processo(s) seletivo(s)...`)

      for (const ref of listRes.processes) void generateOneProcessDoc(ref, credentials, crmDomain)
    } finally {
      setPortalSubmitting(false)
    }
  }

  const showStylePanel =
    docMode === "processo"
      ? loading || !!model || !!error
      : portalSubmitting || portalOverviewLoading || !!portalOverview || processDocs.length > 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="h-5 w-5" /> Trilhas de lógica
        </h1>
        <p className="text-sm text-muted-foreground">
          Lê a mesma estrutura de um processo seletivo ou de um portal inteiro usada em &quot;Gerar documentação&quot;, mas
          mostra apenas as trilhas de lógica: onde cada regra de exibição/ocultação/execução está configurada, suas
          condições, e de onde vem o valor de cada campo (consulta SQL TOTVS ou fonte externa) — início, meio e fim de
          cada caminho.
        </p>
      </div>

      <Card>
        <CollapsibleCardHeader
          title="Parâmetros das trilhas"
          open={formOpen}
          onToggle={() => setFormOpen((open) => !open)}
          controlsId="ps-logic-docs-form"
          expandLabel="Expandir parâmetros"
          collapseLabel="Recolher parâmetros"
          summary={[
            docMode === "portal" ? `Portal inteiro · ${idPortalValue || "—"}` : `Processo seletivo · ${idPsValue || "—"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <CardContent id="ps-logic-docs-form" hidden={!formOpen}>
          <form
            onSubmit={handleSubmit((d) => (d.docMode === "processo" ? handleSubmitProcesso(d) : handleSubmitPortal(d)))}
            className="space-y-4"
            noValidate
          >
            <Field>
              <FieldLabel>
                Deseja as trilhas de lógica de um processo seletivo específico ou do portal inteiro?
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

            {docMode === "portal" && (
              <Field>
                <FieldLabel>Escopo</FieldLabel>
                <ToggleButtonGroup
                  exclusive
                  color="primary"
                  value={escopoPortal}
                  onChange={(_e, v: EscopoPortal | null) => v && setEscopoPortal(v)}
                  aria-label="Escopo das trilhas do portal"
                  sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { gap: 1, px: 2, textTransform: "none" } }}
                >
                  <ToggleButton value="tudo">Portal e processos seletivos</ToggleButton>
                  <ToggleButton value="portal">Apenas o portal</ToggleButton>
                </ToggleButtonGroup>
              </Field>
            )}

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
                Gerar trilhas de lógica
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

      {docMode === "processo" && logicDoc && <LogicTrailResult model={logicDoc} warnings={warnings} style={style} />}

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

      {docMode === "portal" && !portalOverviewLoading && portalLogicDoc && (
        <LogicTrailResult model={portalLogicDoc} warnings={portalOverview?.warnings ?? []} style={style} />
      )}

      {docMode === "portal" && processDocs.length > 0 && (
        <Card>
          <CollapsibleCardHeader
            title={`Processos seletivos do portal (${processDocs.length})`}
            open={processesOpen}
            onToggle={() => setProcessesOpen((open) => !open)}
            controlsId="ps-logic-docs-processes"
            expandLabel="Expandir processos"
            collapseLabel="Recolher processos"
          />
          <CardContent id="ps-logic-docs-processes" hidden={!processesOpen}>
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
                        {p.error ?? "Falha ao gerar as trilhas deste processo."}
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
                        <LogicTrailResult model={extractLogicTrails(p.doc)} warnings={p.warnings} style={style} />
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
