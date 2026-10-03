"use client"

import { Braces } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { VariableGroup } from "@/lib/message-templates/variable-catalog"

interface VariablePickerProps {
  groups: VariableGroup[]
  /** Receives the key; the caller inserts `{{key}}` where it fits (cursor, editor…). */
  onSelect: (key: string) => void
  /** Icon-only trigger, for compact spots (table cells, inspector fields). */
  compact?: boolean
  disabled?: boolean
}

/** "Adicionar variável" menu: groups → fields, each showing its `{{key}}`. */
export function VariablePicker({ groups, onSelect, compact, disabled }: VariablePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        title="Adicionar variável"
        className={cn(
          buttonVariants({ variant: "outline", size: compact ? "icon-sm" : "sm" }),
          // Explicit app color: inside the white email canvas the inherited text color would be dark.
          "shrink-0 cursor-pointer border-primary bg-transparent text-primary hover:bg-primary/10 hover:text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary dark:border-primary dark:bg-transparent dark:hover:bg-primary/15"
        )}
        // Keep focus (and the caret position) in the field the variable is inserted into.
        onMouseDown={(e) => e.preventDefault()}
      >
        <Braces className="h-3.5 w-3.5" />
        {!compact && <span>Adicionar variável</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {groups.map((group) => (
          <DropdownMenuSub key={group.id}>
            <DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-96 overflow-y-auto">
              {group.fields.map((field) => (
                <DropdownMenuItem
                  key={field.key}
                  onClick={() => onSelect(field.key)}
                  className="flex items-center justify-between gap-6"
                >
                  <span>{field.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{`{{${field.key}}}`}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
