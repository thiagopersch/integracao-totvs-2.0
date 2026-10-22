"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { EMAIL_WIDTH_PRESETS, MAX_EMAIL_WIDTH, MIN_EMAIL_WIDTH } from "@/lib/message-templates/render-email"

const clamp = (n: number) => Math.round(Math.min(Math.max(n, MIN_EMAIL_WIDTH), MAX_EMAIL_WIDTH))

/** Template-level body width (MessageTemplate.emailWidth): presets + a free value, clamped on blur. */
export function EmailWidthField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="space-y-1.5">
      <Label htmlFor="email-width">Largura do e-mail</Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          {EMAIL_WIDTH_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                "h-7 rounded-[5px] px-2.5 text-xs transition-colors",
                value === preset ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {preset}px
            </button>
          ))}
        </div>
        <div className="relative w-28">
          <Input
            id="email-width"
            type="number"
            min={MIN_EMAIL_WIDTH}
            max={MAX_EMAIL_WIDTH}
            step={10}
            value={draft ?? value}
            onChange={(e) => {
              setDraft(e.target.value)
              const n = Number(e.target.value)
              if (n >= MIN_EMAIL_WIDTH && n <= MAX_EMAIL_WIDTH) onChange(Math.round(n))
            }}
            onBlur={() => {
              if (draft !== null) onChange(clamp(Number(draft) || value))
              setDraft(null)
            }}
            className="h-8 pr-8 text-xs"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">px</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        600px funciona em qualquer cliente de e-mail. Larguras maiores ajudam tabelas com muitas colunas; no celular alguns
        clientes reduzem o zoom.
      </p>
    </div>
  )
}
