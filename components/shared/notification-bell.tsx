"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { NotificationDetailDialog } from "@/components/shared/notification-detail-dialog"
import { listNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications"
import { getNotificationCategory } from "@/lib/notification-category"
import { ERROR_KIND_LABELS, type ErrorKind } from "@/lib/error-kind"
import { formatRelativeTime } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { Notification } from "@prisma/client"

const POPOVER_NOTIFICATION_LIMIT = 4

type ChangeEntry = { field: string; from?: unknown; to?: unknown }

function formatShort(value: unknown): string {
  if (value === undefined || value === null) return "vazio"
  if (typeof value === "object") return "..."
  return String(value)
}

/** Short second line for a popover card. For audit-type notifications, summarizes what actually
 *  changed; for failure notifications (soap/backup/integration), surfaces the client + error kind
 *  instead — keeps cards useful at a glance without needing the full detail dialog either way. */
function summarizeDataLine(data: unknown): string | null {
  if (!data || typeof data !== "object") return null

  const failure = data as { clientName?: string; errorKind?: ErrorKind }
  if (failure.clientName || failure.errorKind) {
    const parts = [
      failure.clientName ? `Cliente: ${failure.clientName}` : null,
      failure.errorKind ? ERROR_KIND_LABELS[failure.errorKind] : null,
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(" · ")
  }

  const changes = (data as { changes?: ChangeEntry[] }).changes
  if (!changes || changes.length === 0) return null
  if (changes.length === 1) {
    const change = changes[0]
    if ("to" in change && !("from" in change)) return `${change.field}: ${formatShort(change.to)}`
    if ("from" in change && !("to" in change)) return `${change.field} removido`
    return `${change.field}: ${formatShort(change.from)} → ${formatShort(change.to)}`
  }
  return `${changes.length} campos alterados`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [detail, setDetail] = useState<Notification | null>(null)

  async function load() {
    try {
      // The popover is a quick glance, not the full inbox — only the most recent
      // POPOVER_NOTIFICATION_LIMIT show here; everything else lives behind "Ver todas".
      const result = await listNotifications(1, POPOVER_NOTIFICATION_LIMIT)
      setItems(result.data as Notification[])
      setUnreadCount(result.unreadCount)
    } catch (error) {
      console.error("Failed to load notifications", error)
    }
  }

  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    // Strict Mode's dev-only double-invoke would otherwise fire this initial load() twice on
    // every mount; the ref survives that replay, so it still runs exactly once.
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true
      load()
    }

    // Live updates via SSE — falls back to the old 60s polling if the stream errors out
    // (e.g. a proxy that mishandles text/event-stream), so the bell never goes fully silent.
    let pollInterval: ReturnType<typeof setInterval> | null = null
    function startPolling() {
      if (pollInterval) return
      pollInterval = setInterval(load, 60000)
    }
    function stopPolling() {
      if (!pollInterval) return
      clearInterval(pollInterval)
      pollInterval = null
    }

    const source = new EventSource("/api/notifications/stream")
    source.addEventListener("ready", stopPolling)
    source.addEventListener("notification", load)
    source.onerror = startPolling

    return () => {
      source.close()
      stopPolling()
    }
  }, [])

  async function handleClick(notification: Notification) {
    if (!notification.readAt) {
      await markNotificationAsRead(notification.id)
      load()
    }
    setDetail(notification)
  }

  async function handleReadAll() {
    await markAllNotificationsAsRead()
    load()
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="relative rounded-md p-2 hover:bg-accent">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-96 !bg-popover !opacity-100 p-0 shadow-lg"
          style={{ backgroundColor: "var(--popover)" }}
        >
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-medium">Notificações</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReadAll}>
                Marcar todas como lidas
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-96">
            {items.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
            ) : (
              <div className="divide-y">
                {items.map((n) => {
                  const category = getNotificationCategory(n.type)
                  const dataLine = summarizeDataLine(n.data)
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        setOpen(false)
                        handleClick(n)
                      }}
                      className={cn(
                        "w-full p-3 text-left text-sm transition-colors hover:bg-accent",
                        !n.readAt && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <category.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                            <span className="truncate font-medium">{n.title}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{formatRelativeTime(n.createdAt)}</span>
                            {dataLine && (
                              <>
                                <span>•</span>
                                <span className="truncate">{dataLine}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
          <div className="border-t p-2">
            <Link
              href="/notifications"
              className="block rounded-md p-1.5 text-center text-xs text-muted-foreground hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Ver todas
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <NotificationDetailDialog
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        notification={detail}
      />
    </>
  )
}
