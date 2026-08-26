"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { listNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications"
import { cn } from "@/lib/utils"

type NotificationItem = {
  id: string
  title: string
  body: string
  readAt: Date | null
  createdAt: Date
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function load() {
    try {
      const result = await listNotifications(1, 10)
      setItems(result.data as NotificationItem[])
      setUnreadCount(result.unreadCount)
    } catch (error) {
      console.error("Failed to load notifications", error)
    }
  }

  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    // Strict Mode's dev-only double-invoke would otherwise fire this initial load() twice on
    // every mount; the ref survives that replay, so it still runs exactly once, while the
    // interval itself is always (re)created so polling keeps working correctly either way.
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true
      load()
    }
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  async function handleRead(id: string) {
    await markNotificationAsRead(id)
    load()
  }

  async function handleReadAll() {
    await markAllNotificationsAsRead()
    load()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative rounded-md p-2 hover:bg-accent">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-medium">Notificações</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReadAll}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.readAt && handleRead(n.id)}
                  className={cn(
                    "w-full p-3 text-left text-sm transition-colors hover:bg-accent",
                    !n.readAt && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="font-medium">{n.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link href="/notifications" className="block rounded-md p-1.5 text-center text-xs text-muted-foreground hover:bg-accent" onClick={() => setOpen(false)}>
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
