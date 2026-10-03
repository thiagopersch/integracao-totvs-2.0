"use client"

import { useRef } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { VariableGroup } from "@/lib/message-templates/variable-catalog"
import { VariablePicker } from "./variable-picker"

/** Inserts `text` into `value` at the field's caret (or appends), then restores the caret after it. */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  text: string,
  onChange: (next: string) => void
) {
  const start = el?.selectionStart ?? value.length
  const end = el?.selectionEnd ?? value.length
  const next = value.slice(0, start) + text + value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    if (!el) return
    el.focus()
    el.setSelectionRange(start + text.length, start + text.length)
  })
}

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  groups: VariableGroup[]
  placeholder?: string
  id?: string
  multiline?: boolean
  rows?: number
  compact?: boolean
  className?: string
  "aria-invalid"?: boolean
}

/** Text input with an "Adicionar variável" menu that inserts `{{key}}` at the caret position. */
export function VariableInput({
  value,
  onChange,
  groups,
  placeholder,
  id,
  multiline,
  rows = 3,
  compact,
  className,
  ...rest
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const insert = (key: string) =>
    insertAtCursor(multiline ? textareaRef.current : inputRef.current, value, `{{${key}}}`, onChange)

  return (
    <div className={cn("flex items-start gap-2", className)}>
      {multiline ? (
        <Textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={rest["aria-invalid"]}
        />
      ) : (
        <Input
          ref={inputRef}
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={rest["aria-invalid"]}
        />
      )}
      <VariablePicker groups={groups} onSelect={insert} compact={compact} />
    </div>
  )
}
