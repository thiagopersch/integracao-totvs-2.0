"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, Link2, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { PermissionDeniedAlert } from "@/components/tbc-checklist/permission-denied-alert"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { fetchDataserverSchemas } from "@/actions/integrations/tbc-checklist"
import { toChecklistContext, type ChecklistContextForm } from "@/lib/tbc-checklist-dataservers"
import { linkableParents, suggestLinkFields, type LinkFieldPair } from "@/lib/tbc-checklist-links"
import type { TbcChecklistLink } from "@/schemas/tbc-checklist.schema"
import type { TbcChecklistView } from "@/services/tbc-checklist.service"
import type { SchemaTable } from "@/utils/soap-schema"

interface DataserverLinksDialogProps {
  tbcId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  checklist: TbcChecklistView
  /** Data Server whose links are edited. */
  code: string
  dataserverName: (code: string) => string
  /** Contexto saved with the checklist — GetSchema needs it; still editable here. */
  initialContext: ChecklistContextForm
  saving: boolean
  /** TBC user the SOAP calls run as — named in the "sem permissão" message. */
  tbcUser?: string
  onConfirm: (links: TbcChecklistLink[]) => void
}

type SchemaState =
  | { status: "loading" }
  | { status: "loaded"; main: SchemaTable }
  | { status: "error"; error: string; permissionDenied: boolean }

/** A link being edited — `suggest` fills its pairs once both main tables are known. */
type DraftLink = { id: number; parentCode: string; fields: LinkFieldPair[]; suggest: boolean }

const EMPTY_PAIR: LinkFieldPair = { parent: "", child: "" }

/** Field options of a main table — plus any saved name it no longer has, so it still shows. */
function fieldItems(table: SchemaTable, extra: string[]) {
  const items = table.fields.map((f) => ({
    value: f.name,
    label: `${f.name}${f.caption && f.caption !== "-" && f.caption !== f.name ? ` — ${f.caption}` : ""}${f.isPrimaryKey ? " (PK)" : ""}`,
  }))
  const missing = extra.filter((name) => name && !table.fields.some((f) => f.name === name))
  return [...items, ...missing.map((name) => ({ value: name, label: `${name} (não existe mais)` }))]
}

/**
 * Links one Data Server of the checklist to others: per parent, pairs of main-table columns
 * (parent's ↔ this one's — where TOTVS's ReadView filtro applies). With links, the Data Server only
 * loads the rows matching every parent's loaded rows, and the generated SQL joins through them.
 * GetSchema runs once per Data Server (sequentially — Server Actions are serialized anyway).
 */
export function DataserverLinksDialog({
  tbcId,
  open,
  onOpenChange,
  checklist,
  code,
  dataserverName,
  initialContext,
  saving,
  tbcUser,
  onConfirm,
}: DataserverLinksDialogProps) {
  const savedLinks = checklist.dataservers.find((d) => d.dataserverCode === code)?.links ?? []
  const nextId = useRef(savedLinks.length)
  const [contextForm, setContextForm] = useState(initialContext)
  const [links, setLinks] = useState<DraftLink[]>(() =>
    savedLinks.map((l, id) => ({ id, parentCode: l.parentCode, fields: l.fields, suggest: false }))
  )
  // GetSchema results of the current Contexto (`key`), by Data Server code.
  const [schemas, setSchemas] = useState<{ key: string; byCode: Record<string, SchemaState> }>({ key: "", byCode: {} })
  // Main tables already fetched, by "contexto|code" — read when a fetch lands, to fill suggestions.
  const mainsRef = useRef(new Map<string, SchemaTable>())

  const { coligate, branch, levelEducation } = contextForm
  const context = useMemo(() => toChecklistContext({ coligate, branch, levelEducation }), [coligate, branch, levelEducation])
  const contextKey = context ? `${context.coligate}|${context.branch}|${context.levelEducation}` : ""
  const neededCodes = Array.from(new Set([code, ...links.map((l) => l.parentCode).filter(Boolean)]))
  const missingKey = neededCodes.filter((c) => schemas.key !== contextKey || !schemas.byCode[c]).join(",")

  const schemaOf = (c: string): SchemaState | undefined => (schemas.key === contextKey ? schemas.byCode[c] : undefined)
  const own = schemaOf(code)
  const ownMain = own?.status === "loaded" ? own.main : undefined

  /** Fills the empty pairs of links waiting for a suggestion once both main tables are known. */
  function applySuggestions(key: string) {
    const child = mainsRef.current.get(`${key}|${code}`)
    if (!child) return
    setLinks((prev) =>
      prev.map((link) => {
        const parent = link.suggest && mainsRef.current.get(`${key}|${link.parentCode}`)
        if (!parent) return link
        const empty = link.fields.every((f) => !f.parent && !f.child)
        const suggested = suggestLinkFields(parent, child)
        return { ...link, suggest: false, fields: empty && suggested.length ? suggested : link.fields }
      })
    )
  }

  const applySuggestionsRef = useRef(applySuggestions)
  useEffect(() => {
    applySuggestionsRef.current = applySuggestions
  })

  useEffect(() => {
    if (!context || !missingKey) return
    const key = contextKey
    const codes = missingKey.split(",")
    // Debounced so typing "12" in coligada doesn't fetch for "1" first.
    const timer = setTimeout(async () => {
      setSchemas((prev) => ({
        key,
        byCode: { ...(prev.key === key ? prev.byCode : {}), ...Object.fromEntries(codes.map((c) => [c, { status: "loading" as const }])) },
      }))
      const byCode = await fetchDataserverSchemas({ tbcId, dataserverCodes: codes, context })
      const states: Record<string, SchemaState> = {}
      for (const c of codes) {
        const result = byCode[c]
        if (!result) continue
        states[c] = result.success
          ? { status: "loaded", main: result.tables[0] }
          : { status: "error", error: result.error, permissionDenied: result.permissionDenied }
        if (result.success) mainsRef.current.set(`${key}|${c}`, result.tables[0])
      }
      setSchemas((prev) => (prev.key === key ? { key, byCode: { ...prev.byCode, ...states } } : prev))
      applySuggestionsRef.current(key)
    }, 400)
    return () => clearTimeout(timer)
  }, [missingKey, contextKey, context, tbcId])

  const allowed = linkableParents(checklist.dataservers, code)
  const usedParents = links.map((l) => l.parentCode)
  const canAddLink = allowed.some((c) => !usedParents.includes(c))

  function updateLink(id: number, patch: Partial<DraftLink>) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function handleSelectParent(link: DraftLink, parentCode: string) {
    updateLink(link.id, { parentCode, fields: [EMPTY_PAIR], suggest: true })
    // Already known (from another link): suggest right away — otherwise once its GetSchema lands.
    applySuggestions(contextKey)
  }

  function handleSuggest(link: DraftLink, parent: SchemaTable) {
    if (!ownMain) return
    const suggested = suggestLinkFields(parent, ownMain)
    if (!suggested.length) {
      toast.info("Nenhum campo-chave com o mesmo nome nas duas tabelas principais — escolha os pares manualmente.")
      return
    }
    updateLink(link.id, { fields: suggested })
  }

  function updatePair(link: DraftLink, index: number, patch: Partial<LinkFieldPair>) {
    updateLink(link.id, { fields: link.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) })
  }

  const complete = links.every((l) => l.parentCode && l.fields.length > 0 && l.fields.every((f) => f.parent && f.child))
  // A link saved before the order rule may point to a Data Server below this one — it must go.
  const misplaced = links.some((l) => l.parentCode && !allowed.includes(l.parentCode))
  const canConfirm = complete && !misplaced && !saving

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vínculos — {dataserverName(code)}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
          <p className="text-xs text-muted-foreground">
            Com vínculos, este Data Server só carrega os registros cujos campos casam com os registros carregados de{" "}
            <b>todos</b> os Data Servers vinculados (além do CODCOLIGADA/IDPS do processo seletivo). Os campos são os da tabela
            principal de cada um, e a SQL gerada liga as tabelas por eles. Só os Data Servers acima deste na lista podem filtrá-lo —
            arraste-os na lista do checklist para mudar a ordem.
          </p>

          <ChecklistContextFields value={contextForm} onChange={setContextForm} />

          {!context ? (
            <p className="text-xs text-muted-foreground">Preencha coligada, filial e tipo de curso para buscar os campos no TOTVS.</p>
          ) : !own || own.status === "loading" ? (
            <div className="space-y-2" role="status" aria-label={`Buscando campos de ${dataserverName(code)} no TOTVS`}>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ) : own.status === "error" ? (
            own.permissionDenied ? (
              <PermissionDeniedAlert tbcUser={tbcUser} dataservers={[{ code, name: dataserverName(code) }]} />
            ) : (
              <p className="text-sm text-destructive">{own.error}</p>
            )
          ) : null}

          {links.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhum vínculo — este Data Server é filtrado pelo CODCOLIGADA/IDPS do processo seletivo.
            </p>
          )}

          {links.map((link) => {
            const parentState = link.parentCode ? schemaOf(link.parentCode) : undefined
            const parentMain = parentState?.status === "loaded" ? parentState.main : undefined
            const below = !!link.parentCode && !allowed.includes(link.parentCode)
            const parentItems = [
              ...allowed.filter((c) => c === link.parentCode || !usedParents.includes(c)),
              ...(below ? [link.parentCode] : []),
            ].map((c) => ({ value: c, label: `${dataserverName(c)} (${c})${c === link.parentCode && below ? " — abaixo deste" : ""}` }))
            return (
              <div key={link.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 basis-48">
                    <Combobox
                      items={parentItems}
                      value={link.parentCode}
                      onValueChange={(value) => handleSelectParent(link, value)}
                      placeholder="Filtrado por..."
                      searchPlaceholder="Buscar Data Server..."
                      emptyText="Nenhum Data Server disponível."
                    />
                  </div>
                  <WithTooltip label="Preencher com os campos-chave de mesmo nome das duas tabelas principais" disabledSafe>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!parentMain || !ownMain}
                      onClick={() => parentMain && handleSuggest(link, parentMain)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Sugerir campos
                    </Button>
                  </WithTooltip>
                  <WithTooltip label="Remover este vínculo">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remover vínculo"
                      onClick={() => setLinks((prev) => prev.filter((l) => l.id !== link.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </WithTooltip>
                </div>

                {below && (
                  <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">
                      {dataserverName(link.parentCode)} está abaixo deste Data Server na lista — só um Data Server acima pode filtrá-lo.
                      Escolha outro ou remova o vínculo; para mantê-lo, arraste {dataserverName(link.parentCode)} para cima na lista.
                    </span>
                  </p>
                )}

                {link.parentCode &&
                  (!parentState || parentState.status === "loading" ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando campos de {dataserverName(link.parentCode)} no TOTVS...
                    </p>
                  ) : parentState.status === "error" ? (
                    parentState.permissionDenied ? (
                      <PermissionDeniedAlert tbcUser={tbcUser} dataservers={[{ code: link.parentCode, name: dataserverName(link.parentCode) }]} />
                    ) : (
                      <p className="text-sm text-destructive">{parentState.error}</p>
                    )
                  ) : (
                    ownMain && (
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-2 sm:grid">
                          <FieldLabel className="min-w-0 truncate text-xs">
                            {dataserverName(link.parentCode)} · {parentState.main.name}
                          </FieldLabel>
                          <span />
                          <FieldLabel className="min-w-0 truncate text-xs">
                            {dataserverName(code)} · {ownMain.name}
                          </FieldLabel>
                          <span />
                        </div>
                        {link.fields.map((pair, index) => (
                          <div key={index} className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-center">
                            <Combobox
                              items={fieldItems(parentState.main, [pair.parent])}
                              value={pair.parent}
                              onValueChange={(value) => updatePair(link, index, { parent: value })}
                              placeholder={`Campo de ${dataserverName(link.parentCode)}`}
                              searchPlaceholder="Buscar campo..."
                              emptyText="Nenhum campo."
                            />
                            <span className="hidden text-sm text-muted-foreground sm:block">=</span>
                            <Combobox
                              items={fieldItems(ownMain, [pair.child])}
                              value={pair.child}
                              onValueChange={(value) => updatePair(link, index, { child: value })}
                              placeholder={`Campo de ${dataserverName(code)}`}
                              searchPlaceholder="Buscar campo..."
                              emptyText="Nenhum campo."
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remover par de campos"
                              className="self-end sm:self-auto"
                              disabled={link.fields.length === 1}
                              onClick={() => updateLink(link.id, { fields: link.fields.filter((_, i) => i !== index) })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={link.fields.length >= 10}
                            onClick={() => updateLink(link.id, { fields: [...link.fields, EMPTY_PAIR] })}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Adicionar par de campos
                          </Button>
                        </div>
                      </div>
                    )
                  ))}
              </div>
            )
          })}

          <div>
            <WithTooltip
              label={canAddLink ? "Filtrar por mais um Data Server" : "Não há outro Data Server acima deste na lista para filtrá-lo"}
              disabledSafe
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAddLink || links.length >= 10}
                onClick={() => setLinks((prev) => [...prev, { id: nextId.current++, parentCode: "", fields: [EMPTY_PAIR], suggest: false }])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar vínculo
              </Button>
            </WithTooltip>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(links.map((l) => ({ parentCode: l.parentCode, fields: l.fields })))}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar vínculos ({links.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
