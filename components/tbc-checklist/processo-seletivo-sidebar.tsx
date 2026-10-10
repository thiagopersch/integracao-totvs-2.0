"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search, FolderKanban, PanelLeftClose, PanelLeftOpen, Plus, RefreshCcw, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { PermissionDeniedAlert } from "@/components/tbc-checklist/permission-denied-alert"
import { cn } from "@/lib/utils"
import { searchProcessosSeletivos, type ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { processoKey, type ProcessoSeletivoOption } from "@/lib/tbc-checklist-processos"
import {
  PROCESSO_SELETIVO_DATASERVER,
  toChecklistContext,
  type ChecklistContextForm,
} from "@/lib/tbc-checklist-dataservers"
import type { TbcChecklistProcessoView } from "@/services/tbc-checklist.service"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

export type ProcessoSeletivo = {
  /** Id of the processo saved in the checklist. */
  id: string
  label: string
  /** CODCOLIGADA + IDPS — the key every Data Server of the checklist is looked up by. */
  pkValues: Record<string, string>
  /** Contexto (coligada/filial/tipo de curso) the processo was saved with, reused to load it. */
  context: ChecklistContext
}

/** Data Server + Contexto of the last processo search, saved with the checklist to pre-fill the next. */
export type ProcessoSearchSetup = {
  dataserverCode: string
  context: ChecklistContextForm
}

interface ProcessoSeletivoSidebarProps {
  tbcId: string
  dataservers: Dataserver[]
  /** Processos saved in the checklist — listed straight from the database, no TOTVS call. */
  processos: TbcChecklistProcessoView[]
  selectedProcesso: ProcessoSeletivo | null
  onSelectProcesso: (processo: ProcessoSeletivo | null) => void
  /** TBC user the SOAP calls run as — named in the "sem permissão" message. */
  tbcUser?: string
  /** Pre-fills the search form. Read on mount only (remount with a key to change it). */
  initialSearch: { dataserverCode: string | null; context: ChecklistContextForm }
  /** Every successful search reports the setup it used, for the caller to persist. */
  onSearched?: (setup: ProcessoSearchSetup) => void
  /** Saves the picked processos; resolves `true` once they are in the checklist. */
  onAddProcessos: (processos: ProcessoSeletivoOption[]) => Promise<boolean>
  onRemoveProcesso: (id: string) => Promise<void>
  /** Fetches this processo's checklist data again from TOTVS (and opens it). */
  onRefreshProcesso: (processo: ProcessoSeletivo) => void
  /** Drops the loaded data of every processo, so each one is fetched again. */
  onRefreshAll: () => void
}

export function toProcessoSeletivo(p: TbcChecklistProcessoView): ProcessoSeletivo {
  return {
    id: p.id,
    label: `${p.idps} - ${p.name}`,
    pkValues: { CODCOLIGADA: String(p.codColigada), IDPS: String(p.idps) },
    context: { coligate: p.codColigada, branch: p.codFilial, levelEducation: p.levelEducation },
  }
}

const matchesSearch = (text: string, search: string) => !search.trim() || text.toLowerCase().includes(search.trim().toLowerCase())

export function ProcessoSeletivoSidebar({
  tbcId,
  dataservers,
  processos,
  selectedProcesso,
  onSelectProcesso,
  tbcUser,
  initialSearch,
  onSearched,
  onAddProcessos,
  onRemoveProcesso,
  onRefreshProcesso,
  onRefreshAll,
}: ProcessoSeletivoSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // A checklist with no processo (new, or its last one removed) shows the search — nothing to list.
  const searching = searchOpen || processos.length === 0
  const [search, setSearch] = useState("")

  const [dataserverId, setDataserverId] = useState(
    () =>
      dataservers.find((d) => d.code === (initialSearch.dataserverCode || PROCESSO_SELETIVO_DATASERVER))?.id ??
      dataservers.find((d) => d.code === PROCESSO_SELETIVO_DATASERVER)?.id ??
      ""
  )
  const [contextForm, setContextForm] = useState<ChecklistContextForm>(initialSearch.context)
  const [idps, setIdps] = useState("")
  // New checklist with its search already set up (Data Server + Contexto saved): list once on open.
  const [autoSearch] = useState(() =>
    processos.length === 0 && initialSearch.dataserverCode ? toChecklistContext(initialSearch.context) : null
  )
  const [loading, setLoading] = useState(autoSearch !== null)
  // Code of the Data Server TOTVS refused the search for lack of permission.
  const [deniedCode, setDeniedCode] = useState("")
  const [results, setResults] = useState<ProcessoSeletivoOption[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [resultSearch, setResultSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const selectedDataserver = dataservers.find((d) => d.id === dataserverId)
  const context = toChecklistContext(contextForm)
  const savedKeys = new Set(processos.map(processoKey))

  /** Only sets state after the request returns — safe to start from an effect. */
  async function fetchProcessos(dataserverCode: string, searchContext: ChecklistContext, searchIdps: string) {
    const result = await searchProcessosSeletivos({ tbcId, dataserverCode, context: searchContext, idps: searchIdps })
    setLoading(false)
    if (!result.success) {
      if (result.permissionDenied) {
        setDeniedCode(dataserverCode)
        return
      }
      toast.error(result.error || "Falha ao buscar processos seletivos")
      return
    }
    setDeniedCode("")
    setResults(result.processos)
    setPicked(new Set())
    setResultSearch("")
    onSearched?.({
      dataserverCode,
      context: {
        coligate: String(searchContext.coligate),
        branch: String(searchContext.branch),
        levelEducation: String(searchContext.levelEducation),
      },
    })
  }

  const autoSearchedRef = useRef(false)
  useEffect(() => {
    if (autoSearchedRef.current || !autoSearch || !initialSearch.dataserverCode) return
    autoSearchedRef.current = true
    void fetchProcessos(initialSearch.dataserverCode, autoSearch, "")
    // Mount only — later changes are the user's own searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch() {
    if (!selectedDataserver || !context) return
    setLoading(true)
    void fetchProcessos(selectedDataserver.code, context, idps)
  }

  function openSearch() {
    setSearchOpen(true)
    setResults(null)
    setPicked(new Set())
  }

  function closeSearch() {
    setSearchOpen(false)
    setResults(null)
    setPicked(new Set())
  }

  async function handleAdd() {
    if (!results) return
    const toAdd = results.filter((p) => picked.has(processoKey(p)))
    if (!toAdd.length) return
    setAdding(true)
    const ok = await onAddProcessos(toAdd)
    setAdding(false)
    if (ok) closeSearch()
  }

  async function handleRemove() {
    if (!removingId) return
    setRemoving(true)
    await onRemoveProcesso(removingId)
    setRemoving(false)
    setRemovingId(null)
  }

  const filteredResults = (results ?? []).filter((p) => matchesSearch(`${p.idps} - ${p.name}`, resultSearch))
  const pickable = filteredResults.filter((p) => !savedKeys.has(processoKey(p)))
  const allPicked = pickable.length > 0 && pickable.every((p) => picked.has(processoKey(p)))

  function togglePick(key: string, checked: boolean) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setPicked((prev) => {
      const next = new Set(prev)
      for (const p of pickable) {
        if (checked) next.add(processoKey(p))
        else next.delete(processoKey(p))
      }
      return next
    })
  }

  const listed = processos.map(toProcessoSeletivo).filter((p, i) => {
    const saved = processos[i]
    return matchesSearch(`${p.label} ${saved.codColigada} ${saved.codFilial}`, search)
  })
  const removingProcesso = processos.find((p) => p.id === removingId)

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FolderKanban className="h-4 w-4" />
        Processos Seletivos
      </div>
      <div className="flex items-center">
        {!searching && (
          <>
            <WithTooltip label="Atualizar dados de todos os processos seletivos">
              <Button type="button" variant="ghost" size="icon" aria-label="Atualizar dados de todos os processos seletivos" onClick={onRefreshAll}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </WithTooltip>
            <WithTooltip label="Adicionar processo seletivo">
              <Button type="button" variant="ghost" size="icon" aria-label="Adicionar processo seletivo" onClick={openSearch}>
                <Plus className="h-4 w-4" />
              </Button>
            </WithTooltip>
          </>
        )}
        <WithTooltip label="Recolher">
          <Button type="button" variant="ghost" size="icon" aria-label="Recolher" onClick={() => setCollapsed(true)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </WithTooltip>
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-md border transition-[width] duration-200 ease-out",
        // Full width (capped height) when stacked on small screens; fixed side column from lg up.
        collapsed ? "w-full lg:w-12" : "max-h-[60vh] w-full lg:max-h-none lg:w-[380px]"
      )}
    >
      {collapsed ? (
        <div className="flex flex-1 flex-col items-center gap-3 p-2">
          <WithTooltip label="Expandir processos seletivos" side="right">
            <Button type="button" variant="ghost" size="icon" aria-label="Expandir processos seletivos" onClick={() => setCollapsed(false)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </WithTooltip>
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : searching ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          {header}
          <p className="text-xs text-muted-foreground">
            Busque os processos seletivos no TOTVS e selecione quais farão parte deste checklist.
          </p>
          <Field>
            <FieldLabel>Data Server</FieldLabel>
            <Combobox
              items={dataservers.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              value={dataserverId}
              onValueChange={setDataserverId}
              placeholder="Selecione um Data Server"
              searchPlaceholder="Buscar Data Server..."
              emptyText="Nenhum Data Server cadastrado."
            />
          </Field>

          <ChecklistContextFields value={contextForm} onChange={setContextForm} />

          <Field>
            <FieldLabel>IDPS (opcional)</FieldLabel>
            <Input
              type="number"
              placeholder="Ex.: 12"
              value={idps}
              onChange={(e) => setIdps(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <FieldDescription>Vazio = todos os processos seletivos da coligada.</FieldDescription>
          </Field>

          {selectedDataserver && deniedCode === selectedDataserver.code && (
            <PermissionDeniedAlert tbcUser={tbcUser} dataservers={[{ code: selectedDataserver.code, name: selectedDataserver.name }]} />
          )}

          <div className="flex gap-2">
            {processos.length > 0 && (
              <Button type="button" variant="outline" onClick={closeSearch} disabled={adding}>
                Cancelar
              </Button>
            )}
            <Button type="button" className="flex-1" onClick={handleSearch} disabled={!selectedDataserver || !context || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar processos seletivos
            </Button>
          </div>

          {results && (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Filtrar resultado..." value={resultSearch} onChange={(e) => setResultSearch(e.target.value)} />
              </div>
              {pickable.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 px-2 text-xs text-muted-foreground">
                  <Checkbox checked={allPicked} onCheckedChange={(next) => toggleAll(next === true)} />
                  Selecionar todos ({pickable.length})
                </label>
              )}
              <ScrollArea className="min-h-32 flex-1">
                <div className="flex flex-col gap-1 pr-2">
                  {filteredResults.length === 0 && (
                    <p className="p-2 text-xs text-muted-foreground">Nenhum processo seletivo encontrado.</p>
                  )}
                  {filteredResults.map((p) => {
                    const key = processoKey(p)
                    const saved = savedKeys.has(key)
                    return (
                      <label
                        key={key}
                        className={cn(
                          "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                          saved ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-accent"
                        )}
                        title={saved ? "Já adicionado ao checklist" : undefined}
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={saved || picked.has(key)}
                          disabled={saved}
                          onCheckedChange={(next) => togglePick(key, next === true)}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="break-words">
                            {p.idps} - {p.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Colig. {p.codColigada}
                            {saved && " · já adicionado"}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </ScrollArea>
              <Button type="button" onClick={() => void handleAdd()} disabled={picked.size === 0 || adding}>
                {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Adicionar ({picked.size})
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          {header}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1 pr-2">
              {listed.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nenhum processo seletivo encontrado.</p>}
              {listed.map((processo) => {
                const saved = processos.find((p) => p.id === processo.id)
                return (
                  <div
                    key={processo.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-md hover:bg-accent",
                      selectedProcesso?.id === processo.id && "bg-accent"
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onSelectProcesso(processo)}
                            className={cn(
                              "flex min-w-0 flex-1 flex-col px-2 py-1.5 text-left",
                              selectedProcesso?.id === processo.id && "font-medium"
                            )}
                          >
                            <span className="truncate text-sm">{processo.label}</span>
                            {saved && (
                              <span className="text-xs font-normal text-muted-foreground">
                                Colig. {saved.codColigada} · Filial {saved.codFilial} · Nível {saved.levelEducation}
                              </span>
                            )}
                          </button>
                        }
                      />
                      <TooltipContent>{processo.label}</TooltipContent>
                    </Tooltip>
                    <WithTooltip label="Atualizar dados deste processo seletivo">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground"
                        aria-label="Atualizar dados deste processo seletivo"
                        onClick={() => onRefreshProcesso(processo)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </WithTooltip>
                    <WithTooltip label="Remover do checklist">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Remover do checklist"
                        onClick={() => setRemovingId(processo.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </WithTooltip>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      <ConfirmDialog
        open={removingId !== null}
        onOpenChange={(open) => !open && setRemovingId(null)}
        title="Remover processo seletivo do checklist"
        description={`"${removingProcesso ? `${removingProcesso.idps} - ${removingProcesso.name}` : ""}" deixará de aparecer neste checklist. Ele pode ser adicionado novamente pela busca.`}
        confirmLabel="Remover"
        variant="destructive"
        loading={removing}
        loadingLabel="Removendo..."
        onConfirm={() => void handleRemove()}
      />
    </div>
  )
}
