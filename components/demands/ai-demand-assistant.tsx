"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, RotateCcw, Send, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createDemand } from "@/actions/demands"
import { proposeDemandsWithAi } from "@/actions/ai-assistant"
import {
  proposalToFormData,
  validateProposal,
  type DemandProposal,
  type DemandProposalFields,
} from "@/lib/ai/demand-proposal"
import type { AiChatMessage } from "@/lib/ai/types"

interface CatalogEntry {
  id: string
  name: string
  status?: boolean | null
}

interface AiDemandAssistantProps {
  catalogs: {
    clients: CatalogEntry[]
    analysts: CatalogEntry[]
    requesters: CatalogEntry[]
    departments: CatalogEntry[]
    demandTypes: CatalogEntry[]
  }
  onCreated: () => void
}

type ProposalState = DemandProposal & { key: string; created?: boolean; saving?: boolean; reported?: boolean }

interface ChatEntry {
  role: "user" | "assistant"
  /** What is shown in the bubble. */
  display: string
  questions?: string[]
  /** What is sent back to the model as history. */
  content: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

const EXAMPLE =
  "Ex.: Lança 3 demandas para o cliente ITE Toledo, analista João, ontem das 08:00 às 10:00, sobre ajuste no relatório de matrícula. Solicitante Ana, setor Secretaria."

let keySeq = 0
const nextKey = () => `p${++keySeq}`

export function AiDemandAssistant({ catalogs, onCreated }: AiDemandAssistantProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [proposals, setProposals] = useState<ProposalState[]>([])
  const [analystScope, setAnalystScope] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat, proposals.length, thinking])

  const items = (list: CatalogEntry[]) => list.filter((i) => i.status !== false).map((i) => ({ value: i.id, label: i.name }))
  const clientItems = items(catalogs.clients)
  const analystItems = items(catalogs.analysts).filter((a) => !analystScope || a.value === analystScope)
  const requesterItems = items(catalogs.requesters)
  const departmentItems = items(catalogs.departments)
  const typeItems = items(catalogs.demandTypes)

  async function send() {
    const text = input.trim()
    if (!text || thinking) return
    // Tell the model which proposals were already saved so a follow-up doesn't propose them again.
    const newlyCreated = proposals.filter((p) => p.created && !p.reported)
    const content = newlyCreated.length
      ? `${text}\n\n[Já criadas no sistema — não proponha novamente: ${newlyCreated
          .map((p) => `"${p.name}" ${p.date} ${p.startTime}-${p.endTime}`)
          .join("; ")}]`
      : text
    if (newlyCreated.length) setProposals((list) => list.map((p) => (p.created ? { ...p, reported: true } : p)))
    const nextChat: ChatEntry[] = [...chat, { role: "user", display: text, content }]
    setChat(nextChat)
    setInput("")
    setThinking(true)
    const history: AiChatMessage[] = nextChat.map((m) => ({ role: m.role, content: m.content }))
    const result = await proposeDemandsWithAi(history)
    setThinking(false)
    if (!result.success) {
      toast.error(result.error)
      setChat((c) => [...c, { role: "assistant", display: `⚠️ ${result.error}`, content: "Não foi possível processar o pedido." }])
      return
    }
    setAnalystScope(result.analystScope)
    setChat((c) => [...c, { role: "assistant", display: result.reply, questions: result.questions, content: result.assistantMessage }])
    // The AI always returns the full updated list; demands already created stay listed above it.
    setProposals((prev) => [...prev.filter((p) => p.created), ...result.proposals.map((p) => ({ ...p, key: nextKey() }))])
  }

  function update(key: string, patch: Partial<DemandProposalFields>) {
    setProposals((list) =>
      list.map((p) => {
        if (p.key !== key) return p
        const next = { ...p, ...patch }
        return { ...next, errors: validateProposal(next, analystScope) }
      })
    )
  }

  async function confirm(key: string): Promise<boolean> {
    const proposal = proposals.find((p) => p.key === key)
    if (!proposal || proposal.created) return false
    if (Object.keys(proposal.errors).length) {
      toast.error("Corrija os campos destacados antes de confirmar")
      return false
    }
    setProposals((list) => list.map((p) => (p.key === key ? { ...p, saving: true } : p)))
    const result = await createDemand(proposalToFormData(proposal))
    setProposals((list) =>
      list.map((p) => {
        if (p.key !== key) return p
        if (result.success) return { ...p, saving: false, created: true }
        const fieldErrors = Object.fromEntries(
          Object.entries(("errors" in result && result.errors) || {}).map(([k, v]) => [k, (v as string[] | undefined)?.[0] ?? ""])
        )
        return { ...p, saving: false, errors: { ...fieldErrors, _form: result.error ?? "Erro ao criar a demanda" } }
      })
    )
    if (!result.success) toast.error(result.error ?? "Erro ao criar a demanda")
    return !!result.success
  }

  async function confirmAll() {
    const pending = proposals.filter((p) => !p.created && Object.keys(p.errors).length === 0)
    if (!pending.length) return
    setConfirmingAll(true)
    let created = 0
    for (const p of pending) if (await confirm(p.key)) created++
    setConfirmingAll(false)
    if (created) {
      toast.success(`${created} demanda(s) criada(s)`)
      onCreated()
    }
  }

  async function confirmOne(key: string) {
    if (await confirm(key)) {
      toast.success("Demanda criada")
      onCreated()
    }
  }

  function reset() {
    setChat([])
    setProposals([])
    setInput("")
  }

  const pendingValid = proposals.filter((p) => !p.created && Object.keys(p.errors).length === 0).length
  const pendingTotal = proposals.filter((p) => !p.created).length

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="mr-2 h-4 w-4" /> Assistente IA
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Assistente IA de demandas
            </SheetTitle>
            <SheetDescription>
              Descreva as demandas (cliente, analista, data, início e fim, quantidade, assunto). Revise a prévia e confirme — nada é
              gravado sem confirmação.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {chat.length === 0 && <p className="text-xs text-muted-foreground">{EXAMPLE}</p>}
            {chat.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {m.display}
                {m.questions && m.questions.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                    {m.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Montando as demandas...
              </div>
            )}

            {proposals.map((p, index) => (
              <div
                key={p.key}
                className={cn(
                  "space-y-2 rounded-lg border p-3",
                  p.created && "border-emerald-500/50 bg-emerald-500/5",
                  !p.created && Object.keys(p.errors).length > 0 && "border-amber-500/60"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {p.created ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-muted-foreground">#{index + 1}</span>}
                  <span className="truncate">{p.name || "Sem título"}</span>
                  {!p.created && (
                    <div className="ml-auto flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => confirmOne(p.key)}
                        disabled={p.saving || confirmingAll || Object.keys(p.errors).length > 0}
                      >
                        {p.saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                        Confirmar
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Descartar"
                        onClick={() => setProposals((list) => list.filter((x) => x.key !== p.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {p.created && <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-400">Criada</span>}
                </div>
                {!p.created && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ProposalField label="Cliente" error={p.errors.clientId}>
                      <Combobox items={clientItems} value={p.clientId} onValueChange={(clientId) => update(p.key, { clientId })} placeholder="Selecione" searchPlaceholder="Buscar cliente..." />
                    </ProposalField>
                    <ProposalField label="Analista" error={p.errors.analystId}>
                      <Combobox items={analystItems} value={p.analystId} onValueChange={(analystId) => update(p.key, { analystId })} placeholder="Selecione" searchPlaceholder="Buscar analista..." />
                    </ProposalField>
                    <ProposalField label="Solicitante" error={p.errors.requesterId}>
                      <Combobox items={requesterItems} value={p.requesterId} onValueChange={(requesterId) => update(p.key, { requesterId })} placeholder="Selecione" searchPlaceholder="Buscar solicitante..." />
                    </ProposalField>
                    <ProposalField label="Setor" error={p.errors.departmentId}>
                      <Combobox items={departmentItems} value={p.departmentId} onValueChange={(departmentId) => update(p.key, { departmentId })} placeholder="Selecione" searchPlaceholder="Buscar setor..." />
                    </ProposalField>
                    <ProposalField label="Tipo" error={p.errors.demandTypeId}>
                      <Combobox items={typeItems} value={p.demandTypeId} onValueChange={(demandTypeId) => update(p.key, { demandTypeId })} placeholder="Selecione" searchPlaceholder="Buscar tipo..." />
                    </ProposalField>
                    <ProposalField label="Status" error={p.errors.status}>
                      <Select
                        items={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                        value={p.status}
                        onValueChange={(v) => v && update(p.key, { status: v as DemandProposalFields["status"] })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ProposalField>
                    <ProposalField label="Data" error={p.errors.date}>
                      <Input type="date" value={p.date} onChange={(e) => update(p.key, { date: e.target.value })} />
                    </ProposalField>
                    <div className="grid grid-cols-2 gap-2">
                      <ProposalField label="Início" error={p.errors.startTime}>
                        <Input type="time" value={p.startTime} onChange={(e) => update(p.key, { startTime: e.target.value })} />
                      </ProposalField>
                      <ProposalField label="Fim" error={p.errors.endTime}>
                        <Input type="time" value={p.endTime} onChange={(e) => update(p.key, { endTime: e.target.value })} />
                      </ProposalField>
                    </div>
                    <ProposalField label="Título" error={p.errors.name} className="sm:col-span-2">
                      <Input value={p.name} onChange={(e) => update(p.key, { name: e.target.value })} />
                    </ProposalField>
                    <ProposalField label="Descrição" error={p.errors.description} className="sm:col-span-2">
                      <Textarea rows={2} value={p.description} onChange={(e) => update(p.key, { description: e.target.value })} />
                    </ProposalField>
                    {p.errors._form && <p className="text-xs text-destructive sm:col-span-2">{p.errors._form}</p>}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="space-y-2 border-t p-4">
            {pendingTotal > 0 && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {pendingValid} de {pendingTotal} pronta(s) para criar
                </span>
                <Button size="sm" onClick={confirmAll} disabled={!pendingValid || confirmingAll}>
                  {confirmingAll ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                  Confirmar todas
                </Button>
              </div>
            )}
            <Textarea
              rows={3}
              value={input}
              placeholder="Descreva as demandas... (Ctrl+Enter para enviar)"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={reset} disabled={thinking || (!chat.length && !proposals.length)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Nova conversa
              </Button>
              <Button size="sm" onClick={send} disabled={thinking || !input.trim()}>
                {thinking ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                Enviar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function ProposalField({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className={cn("text-xs", error && "text-destructive")}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
