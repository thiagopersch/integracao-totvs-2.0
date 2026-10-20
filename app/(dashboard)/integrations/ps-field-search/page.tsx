"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/shared/data-table"
import { CollapsibleCardHeader } from "@/components/shared/collapsible-card-header"
import { CredentialsFormFields } from "@/components/ps-docs/credentials-form-fields"
import { ComponentDetailPanel } from "@/components/ps-docs/component-detail-panel"
import { TotvsFieldAuditResults, useTotvsFieldAudit } from "@/components/ps-docs/totvs-field-audit"
import { SearchCode, Loader2, RefreshCw, Info, ChevronDown, ChevronRight, Copy, FileSpreadsheet, FileText, FileCode2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { fetchComponentDetail } from "@/actions/integrations/ps-field-search"
import type { ActionCatalogEntries } from "@/actions/integrations/ps-docs"
import { readNdjson, type StandaloneContainer, type SweepEvent } from "@/lib/ps-docs/field-search-stream"
import type { ComponentDetail } from "@/lib/ps-docs/component-detail"
import { componenteLabel, hitsToMarkdown, hitsToSheetRows, hitsToText } from "@/lib/ps-docs/field-search-export"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import {
  buildQuery,
  searchPortalOverview,
  searchProcessDoc,
  searchStandaloneContainer,
  TIPOS_USO,
  type FieldSearchHit,
  type OcultoStatus,
  type ProcessSearchSource,
  type SearchQuery,
} from "@/lib/ps-docs/field-search"
import { parseCookieString, type PsCredentials } from "@/lib/ps-docs/credential"
import { psDocsSchema, type PsDocsFormInput } from "@/schemas/ps-docs.schema"
import type { PortalOverviewSpec } from "@/lib/ps-docs/types"

type DocMode = "processo" | "portal" | "ambiente"
/** "Elementos": find a field/component across the structure. "Integração TOTVS dos campos":
 *  check every field of the registry for its TOTVS table/field/alternative name. */
type SearchKind = "elementos" | "totvs"

/** Everything read for one scope (mode + id + session) — a new term on the same scope only re-runs
 *  the local search instead of calling the Rubeus API again. */
interface LoadedScope {
  key: string
  portal: string
  sources: ProcessSearchSource[]
  overviews: { portal: string; spec: PortalOverviewSpec }[]
  standalone: StandaloneContainer[]
  warnings: string[]
  /** Kept to load a component's detail on demand when a result row is expanded. */
  credentials: PsCredentials
  fieldCatalogEntries: [number, string][]
  actionCatalogEntries?: ActionCatalogEntries
}

type DetailState = { status: "loading" } | { status: "done"; detail: ComponentDetail } | { status: "error"; error: string }

function scopeKey(d: PsDocsFormInput): string {
  const target = d.docMode === "processo" ? d.idPs : d.docMode === "portal" ? `${d.idPortal}:${d.localId}` : "*"
  const { clientId, branch, session } = parseCookieString(d.cookie)
  return [d.docMode, clientId, branch, session, target].join("|")
}

function runQuery(scope: Pick<LoadedScope, "portal" | "sources" | "overviews" | "standalone">, q: SearchQuery): FieldSearchHit[] {
  return [
    ...scope.overviews.flatMap((o) => searchPortalOverview(o.spec, o.portal, q)),
    ...scope.sources.flatMap((s) => searchProcessDoc(s, q)),
    ...scope.standalone.flatMap((c) => searchStandaloneContainer(c, scope.portal, q)),
  ]
}

const OCULTO_VARIANT: Record<OcultoStatus, "destructive" | "secondary" | "success" | "outline"> = {
  Sim: "destructive",
  Condicional: "secondary",
  Não: "success",
  "—": "outline",
}

const dash = (value?: string) => value || "—"

export default function PsFieldSearchPage() {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<PsDocsFormInput>({
    mode: "onChange",
    resolver: zodResolver(psDocsSchema) as Resolver<PsDocsFormInput>,
    defaultValues: { docMode: "processo", cookie: "", idPs: "", crmDomain: "", idPortal: "", localId: "2" },
  })
  const docMode = useWatch({ control, name: "docMode" }) as DocMode
  const idPsValue = useWatch({ control, name: "idPs" })
  const idPortalValue = useWatch({ control, name: "idPortal" })

  const [searchKind, setSearchKind] = useState<SearchKind>("elementos")
  const audit = useTotvsFieldAudit()
  // The audit only needs the cookies, so it validates as "ambiente"; the scope chosen for
  // "Elementos" comes back when switching again.
  const elementosModeRef = useRef<DocMode>("processo")
  function changeSearchKind(kind: SearchKind) {
    if (kind === searchKind) return
    if (kind === "totvs") {
      elementosModeRef.current = docMode
      setValue("docMode", "ambiente", { shouldValidate: true })
    } else {
      setValue("docMode", elementosModeRef.current, { shouldValidate: true })
    }
    setSearchKind(kind)
  }

  const [termo, setTermo] = useState("")
  const [exact, setExact] = useState(false)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<{ label: string; done: number; total: number } | null>(null)
  const [hits, setHits] = useState<FieldSearchHit[]>([])
  const [searched, setSearched] = useState<{ termo: string; mode: DocMode } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [tipoUsoFilter, setTipoUsoFilter] = useState("")
  const [ocultoFilter, setOcultoFilter] = useState("")
  const [textFilter, setTextFilter] = useState("")
  const [loadedScope, setLoadedScope] = useState<LoadedScope | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<number, DetailState>>({})
  // The search form starts open and collapses once results render, so the table gets the room.
  const [formOpen, setFormOpen] = useState(true)
  const [resultsOpen, setResultsOpen] = useState(true)

  const toCredentials = (d: PsDocsFormInput): PsCredentials => parseCookieString(d.cookie)

  // The sweep in flight — a new search or leaving the page cancels it (and its Rubeus requests).
  const sweepRef = useRef<AbortController | null>(null)
  useEffect(() => () => sweepRef.current?.abort(), [])

  /** Reads the whole scope in one streamed request (`POST /api/ps-field-search`) — the server
   *  parallelizes the Rubeus calls and sends each process/portal/page back as soon as it's read,
   *  so the table fills in while the rest is still loading. */
  async function loadScope(data: PsDocsFormInput, q: SearchQuery, signal: AbortSignal): Promise<LoadedScope | null> {
    const scope: LoadedScope = {
      key: scopeKey(data),
      portal: "—",
      sources: [],
      overviews: [],
      standalone: [],
      warnings: [],
      credentials: toCredentials(data),
      fieldCatalogEntries: [],
    }

    // Re-running the search on every streamed piece would re-render the table hundreds of times —
    // at most once per frame instead.
    let frame = 0
    const showPartial = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!signal.aborted) setHits(runQuery(scope, q))
      })
    }

    const res = await fetch("/api/ps-field-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal })
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined
      toast.error(body?.error ?? `Falha na busca (HTTP ${res.status})`)
      return null
    }

    let failure: string | undefined
    let finished = false
    await readNdjson<SweepEvent>(res.body, (event) => {
      switch (event.type) {
        case "progress":
          setPhase({ label: event.label, done: event.done, total: event.total })
          break
        case "overview":
          scope.overviews.push({ portal: event.portal, spec: event.spec })
          showPartial()
          break
        case "source":
          scope.sources.push(event.source)
          showPartial()
          break
        case "standalone":
          scope.standalone.push(...event.containers)
          showPartial()
          break
        case "warning":
          scope.warnings.push(...event.messages)
          break
        case "done":
          scope.portal = event.portal
          scope.fieldCatalogEntries = event.fieldCatalogEntries
          scope.actionCatalogEntries = event.actionCatalogEntries
          finished = true
          break
        case "error":
          failure = event.error
          break
      }
    })
    cancelAnimationFrame(frame)
    if (failure || !finished) {
      toast.error(failure ?? "A busca foi interrompida antes de terminar")
      return null
    }
    return scope
  }

  async function onSubmit(data: PsDocsFormInput, forceReload = false) {
    if (searchKind === "totvs") {
      if (await audit.run(toCredentials(data))) setFormOpen(false)
      return
    }
    const q = buildQuery(termo, exact)
    if (!q.norm) {
      toast.error("Informe o nome do campo ou componente")
      return
    }
    setSearched({ termo: termo.trim(), mode: data.docMode })
    setResultsOpen(true)

    const cached = loadedScope
    if (!forceReload && cached && cached.key === scopeKey(data)) {
      const result = runQuery(cached, q)
      setHits(result)
      if (result.length > 0) setFormOpen(false)
      return
    }

    sweepRef.current?.abort()
    const controller = new AbortController()
    sweepRef.current = controller

    setLoading(true)
    setHits([])
    setWarnings([])
    setLoadedScope(null)
    setExpandedId(null)
    setDetails({})
    setPhase({ label: "iniciando a leitura", done: 0, total: 0 })
    try {
      const scope = await loadScope(data, q, controller.signal)
      if (!scope || controller.signal.aborted) return
      setLoadedScope(scope)
      setWarnings(scope.warnings)
      const result = runQuery(scope, q)
      setHits(result)
      if (result.length > 0) setFormOpen(false)
      toast.success(`${result.length} ocorrência(s) encontrada(s)`)
      if (scope.warnings.length > 0) toast.warning(`${scope.warnings.length} aviso(s) durante a leitura — confira abaixo da tabela.`)
    } catch (e) {
      if (!controller.signal.aborted) toast.error((e as Error).message)
    } finally {
      if (sweepRef.current === controller) {
        sweepRef.current = null
        setLoading(false)
        setPhase(null)
      }
    }
  }

  /** Expands a result row and loads its component's full config (`custom-component/{id}`) once —
   *  later toggles reuse the cached result. */
  async function toggleDetail(hit: FieldSearchHit) {
    if (!hit.componentId || !loadedScope) return
    if (expandedId === hit.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(hit.id)
    const componentId = hit.componentId
    const current = details[componentId]
    if (current && current.status !== "error") return

    setDetails((prev) => ({ ...prev, [componentId]: { status: "loading" } }))
    const res = await fetchComponentDetail({
      credentials: loadedScope.credentials,
      componentId,
      fieldCatalogEntries: loadedScope.fieldCatalogEntries,
      actionCatalogEntries: loadedScope.actionCatalogEntries,
    }).catch((e: Error) => ({ success: false as const, error: e.message, detail: undefined }))
    setDetails((prev) => ({
      ...prev,
      [componentId]: res.success && res.detail ? { status: "done", detail: res.detail } : { status: "error", error: res.error ?? "Falha ao consultar o componente" },
    }))
  }

  function renderDetail(hit: FieldSearchHit) {
    const state = hit.componentId ? details[hit.componentId] : undefined
    if (!state || state.status === "loading") {
      return (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando a configuração do componente...
        </div>
      )
    }
    if (state.status === "error") return <p className="py-3 text-sm text-destructive">{state.error}</p>
    return <ComponentDetailPanel detail={state.detail} highlightOrdem={hit.acaoOrdem} />
  }

  const filteredHits = useMemo(() => {
    const text = textFilter.trim().toLowerCase()
    return hits.filter(
      (h) =>
        (!tipoUsoFilter || h.tipoUso === tipoUsoFilter) &&
        (!ocultoFilter || h.oculto === ocultoFilter) &&
        (!text ||
          [h.portal, h.processo, h.etapa, h.passo, h.feedback, h.pagina, h.popup, h.caminho, h.componente, h.nomeComponente, h.categoria, h.detalheUso, h.motivoOculto]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(text)))
    )
  }, [hits, tipoUsoFilter, ocultoFilter, textFilter])

  async function copyResults(format: "markdown" | "texto") {
    if (!searched) return
    const content = format === "markdown" ? hitsToMarkdown(filteredHits, searched.termo) : hitsToText(filteredHits, searched.termo)
    try {
      await navigator.clipboard.writeText(content)
      toast.success(`${filteredHits.length} ocorrência(s) copiada(s) em ${format === "markdown" ? "Markdown" : "texto"}`)
    } catch {
      toast.error("Não foi possível copiar para a área de transferência")
    }
  }

  async function exportXlsx() {
    if (!searched) return
    try {
      const XLSX = await import("xlsx")
      const rows = hitsToSheetRows(filteredHits, { includePortal: searched.mode !== "processo" })
      const sheet = XLSX.utils.json_to_sheet(rows)
      const headers = Object.keys(rows[0] ?? {})
      sheet["!cols"] = headers.map((h) => ({ wch: Math.min(60, Math.max(h.length, ...rows.map((r) => String(r[h] ?? "").length)) + 2) }))
      if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Ocorrências")
      const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
      downloadBlob(
        new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `buscar-elementos-${slugify(searched.termo) || "resultado"}.xlsx`
      )
    } catch (e) {
      toast.error(`Falha ao exportar: ${(e as Error).message}`)
    }
  }

  const showPortalColumn = !!searched && searched.mode !== "processo"
  const columns = useMemo<ColumnDef<FieldSearchHit>[]>(
    () => [
      ...(showPortalColumn ? [{ accessorKey: "portal", header: "Portal", cell: ({ row }) => dash(row.original.portal) } as ColumnDef<FieldSearchHit>] : []),
      { accessorKey: "processo", header: "Processo", cell: ({ row }) => dash(row.original.processo) },
      { accessorKey: "etapa", header: "Etapa", cell: ({ row }) => dash(row.original.etapa) },
      { accessorKey: "passo", header: "Passo", cell: ({ row }) => dash(row.original.passo) },
      { accessorKey: "feedback", header: "Feedback", cell: ({ row }) => dash(row.original.feedback) },
      { accessorKey: "pagina", header: "Página", cell: ({ row }) => dash(row.original.pagina) },
      { accessorKey: "popup", header: "Pop-up", cell: ({ row }) => dash(row.original.popup) },
      {
        accessorKey: "componente",
        header: "Campo / componente",
        cell: ({ row }) => (
          <div className="min-w-40">
            <div className="font-medium">
              <span>
                {row.original.componente}
                {row.original.nomeComponente && componenteLabel(row.original) !== row.original.componente && (
                  <span className="font-normal text-muted-foreground"> | {row.original.nomeComponente}</span>
                )}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.categoria}
              {row.original.fieldId ? ` · id ${row.original.fieldId}` : ""}
            </div>
            {row.original.caminho && <div className="text-xs text-muted-foreground">em {row.original.caminho}</div>}
          </div>
        ),
      },
      {
        accessorKey: "tipoUso",
        header: "Tipo de uso",
        cell: ({ row }) => (
          <div className="min-w-40">
            <div>{row.original.tipoUso}</div>
            {row.original.detalheUso && <div className="text-xs text-muted-foreground whitespace-normal">{row.original.detalheUso}</div>}
          </div>
        ),
      },
      {
        accessorKey: "oculto",
        header: "Oculto",
        cell: ({ row }) => {
          const badge = <Badge variant={OCULTO_VARIANT[row.original.oculto]}>{row.original.oculto}</Badge>
          if (!row.original.motivoOculto) return badge
          return (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex cursor-help">{badge}</span>} />
              <TooltipContent className="max-w-sm">{row.original.motivoOculto}</TooltipContent>
            </Tooltip>
          )
        },
      },
      {
        id: "detalhes",
        header: () => <span className="sr-only">Detalhes</span>,
        cell: ({ row }) => {
          if (!row.original.componentId) return null
          const open = row.original.id === expandedId
          const label = open ? "Recolher configuração do componente" : "Ver configuração do componente"
          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={label} aria-expanded={open} onClick={() => toggleDetail(row.original)}>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                }
              />
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleDetail only reads state that `expandedId`/`details` changes already re-render
    [showPortalColumn, expandedId, details, loadedScope]
  )

  const filterPanel = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Tipo de uso</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...TIPOS_USO.map((t) => ({ value: t, label: t }))]}
          value={tipoUsoFilter || "all"}
          onValueChange={(v) => setTipoUsoFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TIPOS_USO.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Oculto</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...(["Sim", "Condicional", "Não", "—"] as const).map((o) => ({ value: o, label: o === "—" ? "Não se aplica (referência)" : o }))]}
          value={ocultoFilter || "all"}
          onValueChange={(v) => setOcultoFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Sim">Sim</SelectItem>
            <SelectItem value="Condicional">Condicional</SelectItem>
            <SelectItem value="Não">Não</SelectItem>
            <SelectItem value="—">Não se aplica (referência)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  const isAudit = searchKind === "totvs"
  const busy = isAudit ? audit.loading : loading
  const activePhase = isAudit ? audit.phase : phase
  const canSubmit = isValid && (isAudit || termo.trim().length > 0) && !busy
  const hasLoadedScope = !!loadedScope

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SearchCode className="h-5 w-5" /> Buscar elementos
        </h1>
        <p className="text-sm text-muted-foreground">
          Localiza todos os lugares em que um campo ou componente aparece — etapas, passos, agrupamentos, feedbacks, páginas, pop-ups e
          configurações do portal — inclusive quando oculto, e onde ele é referenciado em lógicas, ações e consultas. Busque num processo,
          num portal ou no ambiente inteiro (todos os portais e fichas).
        </p>
      </div>

      <Card>
        <CollapsibleCardHeader
          title="Parâmetros da busca"
          open={formOpen}
          onToggle={() => setFormOpen((open) => !open)}
          controlsId="ps-field-search-form"
          expandLabel="Expandir parâmetros"
          collapseLabel="Recolher parâmetros"
          summary={
            isAudit ? (
              "Integração TOTVS dos campos"
            ) : (
              <>
                {docMode === "ambiente" ? "Ambiente inteiro" : docMode === "portal" ? `Portal ${idPortalValue || "—"}` : `Processo ${idPsValue || "—"}`}
                {termo.trim() && ` · "${termo.trim()}"`}
                {exact && " · nome exato"}
              </>
            )
          }
        />
        <CardContent id="ps-field-search-form" hidden={!formOpen}>
          <form onSubmit={(e) => handleSubmit((d) => onSubmit(d))(e)} className="space-y-4" noValidate>
            <Field>
              <FieldLabel>O que buscar?</FieldLabel>
              <RadioGroup value={searchKind} onValueChange={(v) => changeSearchKind(v as SearchKind)} className="flex-row flex-wrap gap-x-6 gap-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="elementos" id="kind-elementos" />
                  <Label htmlFor="kind-elementos" className="font-normal cursor-pointer">
                    Campos e componentes
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="totvs" id="kind-totvs" />
                  <Label htmlFor="kind-totvs" className="font-normal cursor-pointer">
                    Integração TOTVS dos campos
                  </Label>
                </div>
              </RadioGroup>
              {isAudit && (
                <p className="text-xs text-muted-foreground">
                  Verifica todos os campos do cadastro (Definições → Campos) e mostra a tabela, o campo e o nome alternativo configurados na Integração TOTVS
                  de cada um — e quais ainda precisam ser configurados.
                </p>
              )}
            </Field>

            {!isAudit && (
            <Field>
              <FieldLabel>Onde buscar?</FieldLabel>
              <RadioGroup value={docMode} onValueChange={(v) => setValue("docMode", v as DocMode, { shouldValidate: true })} className="flex-row flex-wrap gap-x-6 gap-y-2 pt-1">
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
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ambiente" id="mode-ambiente" />
                  <Label htmlFor="mode-ambiente" className="font-normal cursor-pointer">
                    Ambiente inteiro (todas as fichas)
                  </Label>
                </div>
              </RadioGroup>
            </Field>
            )}

            <CredentialsFormFields control={control} errors={errors} />

            {isAudit || docMode === "ambiente" ? null : docMode === "processo" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="idPs">ID do Processo Seletivo no I&M</FieldLabel>
                  <Input id="idPs" inputMode="numeric" {...register("idPs")} placeholder="Ex: 5537" aria-invalid={!!errors.idPs} />
                  <FieldError errors={[errors.idPs]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="crmDomain">Link do CRM</FieldLabel>
                  <Input id="crmDomain" {...register("crmDomain")} placeholder="Ex: https://crmtoledo.apprubeus.com.br/" aria-invalid={!!errors.crmDomain} />
                  <FieldError errors={[errors.crmDomain]} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="idPortal">ID do portal no I&M</FieldLabel>
                  <Input id="idPortal" inputMode="numeric" {...register("idPortal")} placeholder="Ex: 3734" aria-invalid={!!errors.idPortal} />
                  <FieldError errors={[errors.idPortal]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="crmDomainPortal">Link do CRM</FieldLabel>
                  <Input id="crmDomainPortal" {...register("crmDomain")} placeholder="Ex: https://crmtoledo.apprubeus.com.br/" aria-invalid={!!errors.crmDomain} />
                  <FieldError errors={[errors.crmDomain]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="localId">Local ID</FieldLabel>
                  <Input id="localId" inputMode="numeric" {...register("localId")} placeholder="2" aria-invalid={!!errors.localId} />
                  <FieldError errors={[errors.localId]} />
                </Field>
              </div>
            )}

            {!isAudit && (
            <Field>
              <FieldLabel htmlFor="termo" className="flex items-center gap-1.5">
                Nome do campo ou componente
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button type="button" className="inline-flex" aria-label="Ajuda sobre a busca">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    }
                  />
                  <TooltipContent className="max-w-sm">
                    Busca por parte do nome/rótulo, sem diferenciar maiúsculas e acentos. Também encontra ações de botão pelo nome, código da consulta, coluna ou
                    parâmetro configurado (ex.: IDFV) e valor fixo. Um número busca também pelo ID do campo. Use o botão ao lado da coluna Oculto para ver a configuração do
                    componente. Nos modos portal e ambiente, todas as
                    páginas e pop-ups da instituição também são varridos; no modo ambiente, todos os portais e processos ativos.
                  </TooltipContent>
                </Tooltip>
              </FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input id="termo" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex: Nome completo" className="sm:max-w-md" />
                <div className="flex items-center gap-2">
                  <Checkbox id="exact" checked={exact} onCheckedChange={(v) => setExact(v === true)} />
                  <Label htmlFor="exact" className="font-normal cursor-pointer">
                    Nome exato
                  </Label>
                </div>
              </div>
            </Field>
            )}

            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="submit" disabled={!canSubmit}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <SearchCode className="h-4 w-4 mr-2" />}
                  {isAudit ? "Verificar campos" : "Buscar"}
                </Button>
                {!isAudit && hasLoadedScope && (
                  <Button type="button" variant="outline" disabled={!canSubmit} onClick={(e) => handleSubmit((d) => onSubmit(d, true))(e)}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Recarregar estrutura
                  </Button>
                )}
              </div>
              {busy && activePhase && (
                <div className="w-full max-w-xs space-y-1">
                  {activePhase.total > 0 && <Progress value={(activePhase.done / activePhase.total) * 100} />}
                  <p className="text-xs text-muted-foreground text-center">
                    {activePhase.total > 0
                      ? `${activePhase.done}/${activePhase.total} ${activePhase.label}`
                      : `${activePhase.label[0].toUpperCase()}${activePhase.label.slice(1)}...`}
                  </p>
                </div>
              )}
              {!isAudit && !loading && hasLoadedScope && (
                <p className="text-xs text-muted-foreground">Estrutura já carregada — novas buscas no mesmo escopo e sessão não consultam a API de novo.</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {isAudit && audit.ran && <TotvsFieldAuditResults audit={audit} />}

      {!isAudit && searched && (
        <Card>
          <CollapsibleCardHeader
            title={
              <>
                {loading ? "Buscando" : `${filteredHits.length} ocorrência(s)`} de &quot;{searched.termo}&quot;
                {filteredHits.length !== hits.length && ` (de ${hits.length})`}
              </>
            }
            open={resultsOpen}
            onToggle={() => setResultsOpen((open) => !open)}
            controlsId="ps-field-search-results"
            expandLabel="Expandir resultados"
            collapseLabel="Recolher resultados"
          />
          <CardContent id="ps-field-search-results" hidden={!resultsOpen}>
            <DataTable
              columns={columns}
              data={filteredHits}
              loading={loading && hits.length === 0}
              refreshing={loading && hits.length > 0}
              searchPlaceholder="Filtrar resultados..."
              toolbarActions={
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={loading || filteredHits.length === 0}
                    render={
                      <Button variant="outline" size="sm" className="h-9">
                        <MoreHorizontal className="h-4 w-4" /> Ações
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-auto min-w-44 whitespace-nowrap">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Copy className="h-4 w-4" /> Copiar
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => copyResults("markdown")}>
                          <FileCode2 className="h-4 w-4" /> Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyResults("texto")}>
                          <FileText className="h-4 w-4" /> Texto
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onClick={exportXlsx}>
                      <FileSpreadsheet className="h-4 w-4" /> Exportar XLSX
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
              onSearch={setTextFilter}
              filterPanel={filterPanel}
              sortableColumns={["portal", "processo", "etapa", "passo", "feedback", "pagina", "popup", "componente", "tipoUso", "oculto"]}
              pageSize={25}
              expandable={{ isExpanded: (h) => h.id === expandedId, renderExpanded: renderDetail }}
              emptyMessage={loading ? "Lendo a estrutura..." : "Nenhuma ocorrência encontrada."}
            />
          </CardContent>
        </Card>
      )}

      {!isAudit && warnings.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <details>
              <summary className="cursor-pointer text-sm font-medium">{warnings.length} aviso(s) durante a leitura da estrutura</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
