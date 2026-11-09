import { create } from "zustand"
import type { Notification } from "@/generated/prisma/client"

/** Most recent notifications kept for the bell's popover. */
export const BELL_LIMIT = 4

interface NotificationState {
  items: Notification[]
  unreadCount: number
  loaded: boolean
  /** Snapshot from listNotifications (first load, or the polling fallback). */
  hydrate: (items: Notification[], unreadCount: number) => void
  /** A notification pushed by the SSE stream — applied as is, no refetch. */
  receive: (notification: Notification) => void
  /** Optimistic read marks, shared by the bell and the /notifications table. */
  markRead: (id: string) => void
  markAllRead: () => void
}

/** One source of truth for the bell badge and list, so reading in one place updates the other. */
export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  loaded: false,
  hydrate: (items, unreadCount) => set({ items, unreadCount, loaded: true }),
  receive: (notification) =>
    set((state) => {
      if (state.items.some((n) => n.id === notification.id)) return state
      return {
        items: [notification, ...state.items].slice(0, BELL_LIMIT),
        unreadCount: state.unreadCount + (notification.readAt ? 0 : 1),
      }
    }),
  markRead: (id) =>
    set((state) => {
      const target = state.items.find((n) => n.id === id)
      const wasUnreadHere = target && !target.readAt
      return {
        items: state.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date() } : n)),
        // Items outside the popover's 4 can still be unread: count down whenever the caller knows it was unread.
        unreadCount: Math.max(0, state.unreadCount - (wasUnreadHere || !target ? 1 : 0)),
      }
    }),
  markAllRead: () => set((state) => ({ items: state.items.map((n) => (n.readAt ? n : { ...n, readAt: new Date() })), unreadCount: 0 })),
}))
