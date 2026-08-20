"use client"

import { Button } from "@/components/ui/button"

interface DataTableFilterPanelProps {
  children: React.ReactNode
  onApply: () => void
  onClear: () => void
}

export function DataTableFilterPanel({ children, onApply, onClear }: DataTableFilterPanelProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{children}</div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onClear}>
          Limpar
        </Button>
        <Button type="button" variant="default" onClick={onApply}>
          Filtrar
        </Button>
      </div>
    </div>
  )
}
