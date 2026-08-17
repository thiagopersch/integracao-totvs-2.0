import { useEffect, useCallback } from "react"

type KeyHandler = (e: KeyboardEvent) => void

const shortcuts = new Map<string, { handler: KeyHandler; description: string }>()

export function useKeyboardShortcuts() {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.shiftKey ? "Shift" : "", e.altKey ? "Alt" : "", e.key.toUpperCase()]
      .filter(Boolean)
      .join("+")

    const shortcut = shortcuts.get(key)
    if (shortcut) {
      e.preventDefault()
      shortcut.handler(e)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

export function registerShortcut(key: string, handler: KeyHandler, description: string) {
  shortcuts.set(key, { handler, description })
}

export function unregisterShortcut(key: string) {
  shortcuts.delete(key)
}
