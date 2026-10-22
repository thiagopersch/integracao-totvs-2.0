"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, CheckCircle2, History, Loader2, RotateCcw, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { getAiAssistantData, getAiConversation, saveAiConversation, type proposeRecordsWithAi } from "@/actions/ai-assistant"
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
import { ConversationHistory } from "./conversation-history"

type ProposeResult = Awaited<ReturnType<typeof proposeRecordsWithAi>>

/** Calls the assistant route (not a Server Action: a large batch outlives the page's action timeout).
 *  Never throws — network failures and gateway timeouts come back as an error result. */
async function requestProposals(messages: AiChatMessage[]): Promise<ProposeResult> {
  try {
    const response = await fetch("/api/ai-assistant/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
    const data = (await response.json().catch(() => null)) as ProposeResult | null
    if (data) return data
    return {
      success: false,
      error:
        response.status === 504
          ? "A IA demorou demais para responder. Tente pedir menos registros por vez."
          : `Erro ao falar com o assistente (${response.status})`,
    }
  } catch {
    return { success: false, error: "Falha de conexão com o assistente — tente novamente" }
  }
}

interface AiAssistantProps {
  onCreated: () => void
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

/** Panel width: dragged from its left edge, between MIN_WIDTH and half the screen. */
const MIN_WIDTH = 380
const DEFAULT_WIDTH = 672
const WIDTH_STORAGE_KEY = "ai-assistant-width"
const maxWidth = () => Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.5))

function storedWidth() {
  try {
    const value = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    return Number.isFinite(value) && value >= MIN_WIDTH ? value : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

let keySeq = 0
const nextKey = () => `p${++keySeq}`

/** Re-checks every pending proposal against the catalogs and the rest of the batch. */
function revalidate(list: ProposalState[], catalogs: AiCatalogs, analystScope: string | null): ProposalState[] {
  const batch = list.filter((p) => !p.created)
  return list.map((p) => (p.created ? p : { ...p, errors: validateRecord(p.entity, p.values, { catalogs, batch, analystScope }) }))
}

export function AiAssistant({ onCreated }: AiAssistantProps) {
  const [open, setOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
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
  const chatRef = useRef<ChatEntry[]>([])
  const conversationIdRef = useRef<string | null>(null)
  /** Bumped to discard the answer of a request the user walked away from. */
  const requestRef = useRef(0)

  function setChatNow(next: ChatEntry[]) {
    chatRef.current = next
    setChat(next)
  }

  function setConversationIdNow(id: string | null) {
    conversationIdRef.current = id
    setConversationId(id)
  }

  /** Saves the conversation to the user's history (best effort — the chat keeps working without it). */
  async function persist() {
    if (!chatRef.current.length) return
    const result = await saveAiConversation({
      id: conversationIdRef.current ?? undefined,
      chat: chatRef.current,
      proposals: proposalsRef.current.map(({ key, tempId, entity, values, created, createdId, reported }) => ({
        key,
        tempId,
        entity,
        values,
        created,
        createdId,
        reported,
      })),
    })
    if (result.success) setConversationIdNow(result.data.id)
  }

  function setCatalogsNow(next: AiCatalogs) {
    catalogsRef.current = next
    setCatalogs(next)
  }

  async function openAssistant() {
    setWidth(storedWidth())
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
    const nextChat: ChatEntry[] = [...chatRef.current, { role: "user", display: text, content }]
    setChatNow(nextChat)
    setInput("")
    setThinking(true)
    const request = ++requestRef.current
    const history: AiChatMessage[] = nextChat.map((m) => ({ role: m.role, content: m.content }))
    const result = await requestProposals(history)
    // The user left (or started another conversation) while it was thinking: drop the answer.
    if (request !== requestRef.current) return
    setThinking(false)
    if (!result.success) {
      toast.error(result.error)
      setChatNow([...chatRef.current, { role: "assistant", display: `⚠️ ${result.error}`, content: "Não foi possível processar o pedido." }])
      return
    }
    setChatNow([...chatRef.current, { role: "assistant", display: result.reply, questions: result.questions, content: result.assistantMessage }])
    // The AI always returns the full updated list; records already created stay listed above it.
    const reportedKeys = new Set(newlyCreated.map((p) => p.key))
    const kept = proposalsRef.current.filter((p) => p.created).map((p) => (reportedKeys.has(p.key) ? { ...p, reported: true } : p))
    commit([...kept, ...result.proposals.map((p) => ({ ...p, key: nextKey() }))])
    void persist()
  }

  /** Abandons the request in flight: its message goes back to the input box. */
  function abandonRequest() {
    requestRef.current++
    setThinking(false)
    const last = chatRef.current.at(-1)
    if (last?.role === "user") {
      setChatNow(chatRef.current.slice(0, -1))
      setInput(last.display)
    }
  }

  function requestClose() {
    if (thinking) setConfirmClose(true)
    else setOpen(false)
  }

  async function openConversation(id: string) {
    const result = await getAiConversation(id)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    abandonRequest()
    setInput("")
    setChatNow(result.data.chat)
    commit(result.data.proposals.map((p) => ({ ...p, key: nextKey(), errors: {} })))
    setConversationIdNow(result.data.id)
    setShowHistory(false)
  }

  /** Drag the panel's left edge to resize it (up to half the screen). */
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    let next = width
    const move = (e: PointerEvent) => {
      next = Math.min(maxWidth(), Math.max(MIN_WIDTH, window.innerWidth - e.clientX))
      setWidth(next)
    }
    const stop = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", stop)
      handle.removeEventListener("pointercancel", stop)
      try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(next))
      } catch {
        // Width just isn't remembered.
      }
    }
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", stop)
    handle.addEventListener("pointercancel", stop)
  }

  function update(key: string, patch: Record<string, string>) {
    commit(proposalsRef.current.map((p) => (p.key === key ? { ...p, values: { ...p.values, ...patch } } : p)))
  }

  function discard(key: string) {
    const removed = proposalsRef.current.find((p) => p.key === key)
    queueMicrotask(() => void persist())
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
      void persist()
    }
  }

  async function confirmOne(key: string) {
    if (await confirm(key)) {
      toast.success("Registro criado")
      onCreated()
      void persist()
    }
  }

  function reset() {
    abandonRequest()
    setChatNow([])
    commit([])
    setInput("")
    setConversationIdNow(null)
    setShowHistory(false)
  }

  const pending = proposals.filter((p) => !p.created)
  const pendingReady = pending.filter((p) => Object.keys(p.errors).length === 0).length
  const busy = confirmingAll || proposals.some((p) => p.saving)

  return (
    <>
      <Button
        size="icon"
        aria-label="Assistente IA"
        title="Assistente IA — cadastrar conversando"
        onClick={openAssistant}
        className="fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg md:right-6 md:bottom-6"
      >
        <Sparkles className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : requestClose())}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-(--ai-panel-width) data-[side=right]:sm:max-w-[50vw]"
          style={{ "--ai-panel-width": `${width}px` } as React.CSSProperties}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionar o assistente"
            title="Arraste para redimensionar"
            onPointerDown={startResize}
            className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/40 sm:block"
          />
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2 pr-16">
              <Sparkles className="h-4 w-4" /> Assistente IA
              <Button
                size="icon-sm"
                variant={showHistory ? "secondary" : "ghost"}
                aria-label={showHistory ? "Voltar à conversa" : "Conversas anteriores"}
                title={showHistory ? "Voltar à conversa" : "Conversas anteriores"}
                onClick={() => setShowHistory((v) => !v)}
                className="absolute top-3 right-12"
              >
                {showHistory ? <ArrowLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
              </Button>
            </SheetTitle>
            <SheetDescription>
              {showHistory
                ? "Busque uma conversa anterior para reler o contexto ou continuar de onde parou."
                : "Peça o que quer cadastrar. Quando faltar algo, o assistente pergunta; revise a prévia e confirme — nada é gravado sem confirmação."}
            </SheetDescription>
          </SheetHeader>

          {showHistory ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ConversationHistory
                currentId={conversationId}
                onOpen={openConversation}
                onDeletedCurrent={() => setConversationIdNow(null)}
              />
            </div>
          ) : (
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
          )}

          {!showHistory && (
          <div className="shrink-0 space-y-2 border-t p-4">
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
              className="max-h-[40vh] resize-none overflow-y-auto"
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
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Sair do assistente?"
        description="O assistente ainda está respondendo. Se sair agora, essa resposta será perdida (sua mensagem volta para a caixa de texto)."
        confirmLabel="Sair mesmo assim"
        cancelLabel="Continuar aqui"
        variant="destructive"
        onConfirm={() => {
          abandonRequest()
          setConfirmClose(false)
          setOpen(false)
        }}
      />
    </>
  )
}
