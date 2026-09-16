"use client"

import { useState } from "react"
import { CircleCheck, CircleX } from "lucide-react"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"

interface ChecklistFieldCardProps {
  field: ChecklistFieldRow
}

export function ChecklistFieldCard({ field }: ChecklistFieldCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
          field.configurado
            ? "border-green-300 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:hover:bg-green-950/50"
            : "border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:hover:bg-red-950/50"
        )}
      >
        <span
          className={cn(
            "truncate text-sm font-medium",
            field.configurado ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"
          )}
        >
          {field.caption}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            field.configurado ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
          )}
        >
          {field.configurado ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleX className="h-3.5 w-3.5" />}
          {field.configurado ? "Configurado" : "Não configurado"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{field.caption}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-xs text-muted-foreground">Valor no TOTVS</p>
            <p className="rounded-md border bg-muted/50 p-3 text-sm break-words">
              {field.configurado ? field.valor : "Sem valor configurado"}
            </p>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
