"use client"

import { useEffect, useState } from "react"
import { Loader2, MessageSquare, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/utils/format"
import { deleteAiConversation, listAiConversationHistory } from "@/actions/ai-assistant"

interface ConversationItem {
  id: string
  title: string
  updatedAt: Date
}

interface ConversationHistoryProps {
  /** Conversation open in the panel — highlighted in the list. */
  currentId: string | null
  onOpen: (id: string) => void
  /** The open conversation was deleted. */
  onDeletedCurrent: () => void
}

/** Previous conversations of the user, searchable by title and content, to resume or read again. */
export function ConversationHistory({ currentId, onOpen, onDeletedCurrent }: ConversationHistoryProps) {
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<ConversationItem[] | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      listAiConversationHistory(search)
        .then((list) => !cancelled && setItems(list))
        .catch(() => !cancelled && setItems([]))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  async function remove(id: string) {
    setDeleting(id)
    try {
      await deleteAiConversation(id)
      setItems((list) => list?.filter((i) => i.id !== id) ?? null)
      if (id === currentId) onDeletedCurrent()
    } catch {
      toast.error("Não foi possível excluir a conversa")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus className="pl-8" placeholder="Buscar nas conversas..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {items === null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando conversas...
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{search ? "Nenhuma conversa encontrada." : "Nenhuma conversa anterior."}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                  item.id === currentId && "bg-muted"
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatRelativeTime(item.updatedAt)}</span>
                </span>
              </button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Excluir conversa"
                disabled={deleting === item.id}
                onClick={() => remove(item.id)}
                className="opacity-60 group-hover:opacity-100"
              >
                {deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
