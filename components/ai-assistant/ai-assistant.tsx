"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, RotateCcw, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getAiAssistantData, proposeRecordsWithAi } from "@/actions/ai-assistant"
import {
  AI_ENTITIES,
  orderForCreation,
  pendingRefs,
  recordTitle,
  resolveRefs,
  validateRecord,
  type AiCatalogs,
  type AiEntityKey,
} from "@/lib/ai/entities"
import type { AiChatMessage } from "@/lib/ai/types"
import { createRecord } from "./create-record"
import { ProposalCard, type ProposalState } from "./proposal-card"

interface AiAssistantProps {
  onCreated: () => void
  /** "button": toolbar button (e.g. /demands); "floating": chat bubble fixed at the bottom-right corner. */
  trigger?: "button" | "floating"
}

interface ChatEntry {
  role: "user" | "assistant"
  /** What is shown in the bubble. */
  display: string
  questions?: string[]
  /** What is sent back to the model as history. */
  content: string
}

const EXAMPLE =
  "Ex.: \"Cadastra o cliente ACME e um projeto de implantação do RM para ele, com início em 01/11\" ou \"Lança 3 demandas para o ITE Toledo ontem das 08:00 às 10:00, ajuste no relatório de matrícula\"."

let keySeq = 0
const nextKey = () => `p${++keySeq}`

/** Re-checks every pending proposal against the catalogs and the rest of the batch. */
function revalidate(list: ProposalState[], catalogs: AiCatalogs, analystScope: string | null): ProposalState[] {
  const batch = list.filter((p) => !p.created)
  return list.map((p) => (p.created ? p : { ...p, errors: validateRecord(p.entity, p.values, { catalogs, batch, analystScope }) }))
}

export function AiAssistant({ onCreated, trigger = "button" }: AiAssistantProps) {
  const [open, setOpen] = useState(false)
  const [catalogs, setCatalogs] = useState<AiCatalogs>({})
  const [entities, setEntities] = useState<AiEntityKey[]>([])
  const [analystScope, setAnalystScope] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [proposals, setProposals] = useState<ProposalState[]>([])
  const [thinking, setThinking] = useState(false)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  // confirm() runs in a loop ("Confirmar todos"): read the latest state, not the render's closure.
  // Every change to proposals/catalogs goes through commit()/setCatalogsNow(), which keep these in sync.
  const proposalsRef = useRef<ProposalState[]>([])
  const catalogsRef = useRef<AiCatalogs>({})

  function setCatalogsNow(next: AiCatalogs) {
    catalogsRef.current = next
    setCatalogs(next)
  }

  async function openAssistant() {
    setOpen(true)
    if (loaded || loading) return
    setLoading(true)
    try {
      const data = await getAiAssistantData()
      setCatalogsNow(data.catalogs)
      setEntities(data.entities)
      setAnalystScope(data.analystScope)
      setLoaded(true)
    } catch {
      toast.error("Não foi possível carregar os cadastros para o assistente")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat, proposals.length, thinking])

  function commit(next: ProposalState[], nextCatalogs = catalogsRef.current) {
    const validated = revalidate(next, nextCatalogs, analystScope)
    proposalsRef.current = validated
    setProposals(validated)
  }

  async function send() {
    const text = input.trim()
    if (!text || thinking) return
    // Tell the model what was already saved (with the real ids) so a follow-up neither proposes it
    // again nor loses the reference to it.
    const newlyCreated = proposals.filter((p) => p.created && !p.reported)
    const content = newlyCreated.length
      ? `${text}\n\n[Já criados no sistema — não proponha novamente: ${newlyCreated
          .map((p) => `${AI_ENTITIES[p.entity].label} "${recordTitle(p.entity, p.values)}"${p.createdId ? ` (id ${p.createdId})` : ""}`)
          .join("; ")}]`
      : text
    const nextChat: ChatEntry[] = [...chat, { role: "user", display: text, content }]
    setChat(nextChat)
    setInput("")
    setThinking(true)
    const history: AiChatMessage[] = nextChat.map((m) => ({ role: m.role, content: m.content }))
    const result = await proposeRecordsWithAi(history)
    setThinking(false)
    if (!result.success) {
      toast.error(result.error)
      setChat((c) => [...c, { role: "assistant", display: `⚠️ ${result.error}`, content: "Não foi possível processar o pedido." }])
      return
    }
    setChat((c) => [...c, { role: "assistant", display: result.reply, questions: result.questions, content: result.assistantMessage }])
    // The AI always returns the full updated list; records already created stay listed above it.
    const kept = proposalsRef.current.filter((p) => p.created).map((p) => (newlyCreated.includes(p) ? { ...p, reported: true } : p))
    commit([...kept, ...result.proposals.map((p) => ({ ...p, key: nextKey() }))])
  }

  function update(key: string, patch: Record<string, string>) {
    commit(proposalsRef.current.map((p) => (p.key === key ? { ...p, values: { ...p.values, ...patch } } : p)))
  }

  function discard(key: string) {
    const removed = proposalsRef.current.find((p) => p.key === key)
    // References to the discarded record are cleared (and flagged by the revalidation).
    commit(
      proposalsRef.current
        .filter((p) => p.key !== key)
        .map((p) => ({
          ...p,
          values: Object.fromEntries(Object.entries(p.values).map(([k, v]) => [k, removed && v === `@${removed.tempId}` ? "" : v])),
        }))
    )
  }

  /** Title of the pending proposal `p` references, if any — it has to be created first. */
  function waitingFor(p: ProposalState, list = proposals) {
    const dep = pendingRefs(AI_ENTITIES[p.entity], p.values)
      .map((id) => list.find((x) => x.tempId === id && !x.created))
      .find(Boolean)
    return dep ? recordTitle(dep.entity, dep.values) : null
  }

  async function confirm(key: string): Promise<boolean> {
    const proposal = proposalsRef.current.find((p) => p.key === key)
    if (!proposal || proposal.created) return false
    if (Object.keys(proposal.errors).length || waitingFor(proposal, proposalsRef.current)) {
      toast.error("Corrija os campos destacados antes de confirmar")
      return false
    }
    setProposals((list) => list.map((p) => (p.key === key ? { ...p, saving: true } : p)))
    // Its references were already resolved when the records they point to were created (see below).
    const result = await createRecord(proposal.entity, proposal.values)

    if (!result.success) {
      const error = result.error ?? "Erro ao criar o registro"
      // Server errors are kept as-is (not revalidated) until the user edits the card.
      const failed = proposalsRef.current.map((p) => (p.key === key ? { ...p, saving: false, errors: { ...result.errors, _form: error } } : p))
      proposalsRef.current = failed
      setProposals(failed)
      toast.error(error)
      return false
    }

    // The new record joins its catalog and replaces "@tempId" in the proposals that point to it.
    const def = AI_ENTITIES[proposal.entity]
    let nextCatalogs = catalogsRef.current
    if (def.catalog && result.id) {
      const parentId = proposal.entity === "contract" || proposal.entity === "project" ? proposal.values.clientId || null : undefined
      nextCatalogs = {
        ...nextCatalogs,
        [def.catalog]: [...(nextCatalogs[def.catalog] ?? []), { id: result.id, name: recordTitle(proposal.entity, proposal.values), parentId }],
      }
      setCatalogsNow(nextCatalogs)
    }
    const createdIds = result.id ? { [proposal.tempId]: result.id } : {}
    commit(
      proposalsRef.current.map((p) =>
        p.key === key
          ? { ...p, saving: false, created: true, createdId: result.id, errors: {} }
          : p.created
            ? p
            : { ...p, values: resolveRefs(p.entity, p.values, createdIds) }
      ),
      nextCatalogs
    )
    return true
  }

  async function confirmAll() {
    const pending = orderForCreation(proposalsRef.current.filter((p) => !p.created))
    if (!pending.length) return
    setConfirmingAll(true)
    let created = 0
    for (const { key } of pending) {
      const current = proposalsRef.current.find((p) => p.key === key)
      // Skips records still invalid or waiting on one that failed.
      if (!current || Object.keys(current.errors).length || waitingFor(current, proposalsRef.current)) continue
      if (await confirm(key)) created++
    }
    setConfirmingAll(false)
    if (created) {
      toast.success(`${created} registro(s) criado(s)`)
      onCreated()
    }
  }

  async function confirmOne(key: string) {
    if (await confirm(key)) {
      toast.success("Registro criado")
      onCreated()
    }
  }

  function reset() {
    setChat([])
    commit([])
    setInput("")
  }

  const pending = proposals.filter((p) => !p.created)
  const pendingReady = pending.filter((p) => Object.keys(p.errors).length === 0).length
  const busy = confirmingAll || proposals.some((p) => p.saving)

  return (
    <>
      {trigger === "floating" ? (
        <Button
          size="icon"
          aria-label="Assistente IA"
          title="Assistente IA — cadastrar conversando"
          onClick={openAssistant}
          className="fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg md:right-6 md:bottom-6"
        >
          <Sparkles className="size-5" />
        </Button>
      ) : (
        <Button variant="outline" onClick={openAssistant}>
          <Sparkles className="mr-2 h-4 w-4" /> Assistente IA
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Assistente IA
            </SheetTitle>
            <SheetDescription>
              Peça o que quer cadastrar. Quando faltar algo, o assistente pergunta; revise a prévia e confirme — nada é gravado sem
              confirmação.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando cadastros...
              </div>
            )}
            {chat.length === 0 && (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>{EXAMPLE}</p>
                {entities.length > 0 && <p>Posso cadastrar: {entities.map((e) => AI_ENTITIES[e].label).join(", ")}.</p>}
              </div>
            )}
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando...
              </div>
            )}

            {proposals.map((p, index) => (
              <ProposalCard
                key={p.key}
                proposal={p}
                index={index}
                catalogs={catalogs}
                batch={pending}
                waitingFor={p.created ? null : waitingFor(p)}
                busy={busy}
                onChange={update}
                onConfirm={confirmOne}
                onDiscard={discard}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="space-y-2 border-t p-4">
            {pending.length > 0 && (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {pendingReady} de {pending.length} pronto(s) para criar
                </span>
                <Button size="sm" onClick={confirmAll} disabled={!pendingReady || busy}>
                  {confirmingAll ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                  Confirmar todos
                </Button>
              </div>
            )}
            <Textarea
              rows={3}
              value={input}
              placeholder="O que você quer cadastrar? (Ctrl+Enter para enviar)"
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
              <Button size="sm" onClick={send} disabled={thinking || loading || !input.trim()}>
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
