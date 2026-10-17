"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailListInputProps {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  invalid?: boolean
}

/** Chips of e-mail addresses — Enter, comma, semicolon, space or blur adds what was typed (pasting a list works too). */
export function EmailListInput({ id, value, onChange, placeholder, invalid }: EmailListInputProps) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  function commit(text: string) {
    const parts = text
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
    if (parts.length === 0) return
    const bad = parts.filter((p) => !EMAIL_RE.test(p))
    const good = parts.filter((p) => EMAIL_RE.test(p) && !value.includes(p))
    if (good.length) onChange([...value, ...new Set(good)])
    setError(bad.length ? `E-mail inválido: ${bad.join(", ")}` : null)
    setDraft(bad.join(" "))
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1",
          (invalid || error) && "border-destructive"
        )}
      >
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
            {email}
            <button
              type="button"
              aria-label={`Remover ${email}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(value.filter((e) => e !== email))}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
              e.preventDefault()
              commit(draft)
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text")
            if (/[\s,;]/.test(text)) {
              e.preventDefault()
              commit(`${draft} ${text}`)
            }
          }}
          onBlur={() => draft.trim() && commit(draft)}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-40 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
