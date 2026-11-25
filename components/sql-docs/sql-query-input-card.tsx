"use client"

import { useRef, useState } from "react"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Code,
  Database,
  FileUp,
  ListChecks,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { getSentenceSql } from "@/actions/integrations/sql-docs"
import { CodeEditor } from "@/components/shared/code-editor"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible } from "@/components/ui/collapsible"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"
import type { SqlDocSource } from "@/lib/sql-docs/types"
import { codeAndTitleFromFileName, type QueryItem, type SentenceOption } from "./types"

interface SqlQueryInputCardProps {
  item: QueryItem
  index: number
  total: number
  sentences: SentenceOption[]
  canUseSentences: boolean
  disabled: boolean
  onChange: (patch: Partial<QueryItem>) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
  onRetry: () => void
}

const SOURCE_LABEL: Record<SqlDocSource, string> = { upload: "Anexo .sql", paste: "SQL colado", sentence: "Sentença cadastrada" }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** A block that can be minimized; when minimized it shows as a highlighted, clickable bar. */
function CollapsibleSection({
  label,
  summary,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  label: string
  summary: string
  icon: React.ComponentType<{ className?: string }>
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  if (!open) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-expanded={false}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex cursor-pointer items-center gap-3 rounded-md border border-l-4 border-primary/60 border-l-primary bg-primary/15 px-3 py-3 shadow-sm transition-colors hover:bg-primary/25 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">{summary}</span>
        <span className="flex-1" />
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          Expandir <ChevronDown className="h-4 w-4" />
        </span>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1">{label}</p>
        <Button type="button" variant="ghost" size="sm" aria-expanded onClick={onToggle}>
          <ChevronUp className="h-4 w-4 mr-1" /> Minimizar
        </Button>
      </div>
      {children}
    </div>
  )
}

/** One query: pick how it is provided (attach / paste / registered sentence), its code and title,
 *  and — once analysed — the generated rules, editable one per line. */
export function SqlQueryInputCard({ item, index, total, sentences, canUseSentences, disabled, onChange, onRemove, onMove, onRetry }: SqlQueryInputCardProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loadingSentence, setLoadingSentence] = useState(false)
  // Bumped when the SQL is replaced from outside the editor (file / sentence) so CodeMirror reloads it.
  const [editorKey, setEditorKey] = useState(0)
  const [open, setOpen] = useState(true)
  const [sqlOpen, setSqlOpen] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(true)

  async function handleFile(file: File | undefined) {
    if (!file) return
    const sql = await file.text()
    const fromName = codeAndTitleFromFileName(file.name)
    onChange({ fileName: file.name, sql, code: item.code || fromName.code, title: item.title || fromName.title, status: "idle", entry: undefined, rulesText: "", error: undefined })
    setEditorKey((k) => k + 1)
    setSqlOpen(true)
  }

  async function handleSentence(id: string) {
    setLoadingSentence(true)
    const res = await getSentenceSql(id)
    setLoadingSentence(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    onChange({ sentenceId: id, sql: res.content, code: res.code, title: res.name, status: "idle", entry: undefined, rulesText: "", error: undefined })
    setEditorKey((k) => k + 1)
    setSqlOpen(true)
  }

  const statusBadge =
    item.status === "done" ? (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" /> Documentada
      </Badge>
    ) : item.status === "analyzing" ? (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando…
      </Badge>
    ) : item.status === "error" ? (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3.5 w-3.5" /> Erro
      </Badge>
    ) : null

  const sqlLines = item.sql.trim() ? item.sql.trimEnd().split("\n").length : 0
  const ruleCount = item.rulesText.split("\n").filter((r) => r.trim()).length

  return (
    <Card>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
          <CardTitle className="text-sm cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
            Consulta {index + 1}
            {item.code || item.title ? <span className="font-normal text-muted-foreground"> · {[item.code, item.title].filter(Boolean).join(" - ")}</span> : null}
          </CardTitle>
          {statusBadge}
          <div className="flex-1" />
          <WithTooltip disabledSafe label="Mover para cima">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Mover para cima" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
          </WithTooltip>
          <WithTooltip disabledSafe label="Mover para baixo">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Mover para baixo" disabled={disabled || index === total - 1} onClick={() => onMove(1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
          </WithTooltip>
          <WithTooltip disabledSafe label="Remover consulta">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover consulta" disabled={disabled} onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </WithTooltip>
          <WithTooltip label={open ? "Recolher consulta" : "Expandir consulta"}>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={open ? "Recolher consulta" : "Expandir consulta"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </Button>
          </WithTooltip>
        </CardHeader>
        <Collapsible.Panel>
          <CardContent className="space-y-4">
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={item.source}
              disabled={disabled}
              onChange={(_e, v: SqlDocSource | null) => v && onChange({ source: v })}
              aria-label="Origem da consulta"
              sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { gap: 1, px: 2, textTransform: "none" } }}
            >
              <ToggleButton value="upload">
                <FileUp className="h-4 w-4" /> Anexar .sql
              </ToggleButton>
              <ToggleButton value="paste">
                <ClipboardPaste className="h-4 w-4" /> Colar SQL
              </ToggleButton>
              {canUseSentences && (
                <ToggleButton value="sentence">
                  <Database className="h-4 w-4" /> Sentença cadastrada
                </ToggleButton>
              )}
            </ToggleButtonGroup>

            {item.source === "upload" && (
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} type="file" accept=".sql,.txt,text/plain,application/sql" hidden onChange={(e) => void handleFile(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4 mr-2" /> {item.fileName ? "Trocar arquivo" : "Selecionar arquivo .sql"}
                </Button>
                <span className="text-sm text-muted-foreground">{item.fileName ?? "Nenhum arquivo selecionado"}</span>
              </div>
            )}

            {item.source === "sentence" && (
              <Field>
                <FieldLabel htmlFor={`sentence-${item.id}`}>Sentença cadastrada</FieldLabel>
                <Combobox
                  id={`sentence-${item.id}`}
                  items={sentences.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}${s.category ? ` (${s.category})` : ""}` }))}
                  value={item.sentenceId ?? null}
                  onValueChange={(v) => void handleSentence(v)}
                  disabled={disabled || loadingSentence}
                  emptyText="Nenhuma sentença ativa encontrada."
                />
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Field>
                <FieldLabel htmlFor={`code-${item.id}`}>Código</FieldLabel>
                <Input id={`code-${item.id}`} value={item.code} disabled={disabled} placeholder="Ex: RB.PS.CAP.001" onChange={(e) => onChange({ code: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`title-${item.id}`}>Título (em branco: a IA sugere)</FieldLabel>
                <Input id={`title-${item.id}`} value={item.title} disabled={disabled} placeholder="Ex: Cadastra/Atualiza modalidades" onChange={(e) => onChange({ title: e.target.value })} />
              </Field>
            </div>

            {loadingSentence ? (
              <Skeleton className="h-[180px] w-full rounded-md" />
            ) : (
              (item.source === "paste" || item.sql) && (
                <CollapsibleSection
                  label={item.source === "paste" ? "Cole o SQL da consulta" : `SQL (${SOURCE_LABEL[item.source].toLowerCase()}) — pode ser ajustado antes de gerar`}
                  summary={sqlLines ? plural(sqlLines, "linha", "linhas") : "vazio"}
                  icon={Code}
                  open={sqlOpen}
                  onToggle={() => setSqlOpen((o) => !o)}
                >
                  <CodeEditor
                    value={item.sql}
                    language="sql"
                    resetKey={`${item.id}-${editorKey}`}
                    readOnly={disabled}
                    minHeight="180px"
                    onChange={(sql) => onChange({ sql, ...(item.status === "done" ? {} : { status: "idle" as const }) })}
                  />
                </CollapsibleSection>
              )
            )}

            {item.status === "analyzing" && (
              <div className="space-y-2" aria-busy>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                {!!item.progressChars && <p className="text-xs text-muted-foreground">A IA está escrevendo a documentação… ({item.progressChars} caracteres)</p>}
              </div>
            )}

            {item.status === "error" && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 p-3">
                <p className="text-sm text-destructive flex-1">{item.error}</p>
                <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onRetry}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
                </Button>
              </div>
            )}

            {item.status === "done" && (
              <CollapsibleSection
                label="Regras da consulta (uma por linha)"
                summary={plural(ruleCount, "regra", "regras")}
                icon={ListChecks}
                open={rulesOpen}
                onToggle={() => setRulesOpen((o) => !o)}
              >
                <Textarea
                  id={`rules-${item.id}`}
                  aria-label="Regras da consulta (uma por linha)"
                  rows={Math.min(Math.max(item.rulesText.split("\n").length, 4), 16)}
                  value={item.rulesText}
                  disabled={disabled}
                  onChange={(e) => onChange({ rulesText: e.target.value })}
                />
              </CollapsibleSection>
            )}
          </CardContent>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Card>
  )
}
