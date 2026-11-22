"use client"

import { Button } from "@/components/ui/button"
import { InputVariantProvider } from "@/components/ui/field"
import { cn } from "@/lib/utils"

interface DataTableFilterPanelProps {
  children: React.ReactNode
  onApply: () => void
  onClear: () => void
  /** One field per row, scrolling past ~half the viewport — for narrow containers (e.g. a sidebar)
   *  where the default up-to-4-column grid would crush the inputs. */
  singleColumn?: boolean
}

/**
 * Filter box shown between the table toolbar and the grid. Children order convention: select fields
 * (Select, OptionSelect, MultiSelect, Combobox) first, then text inputs, date ranges, sliders and
 * switches/checkboxes last.
 */
export function DataTableFilterPanel({ children, onApply, onClear, singleColumn = false }: DataTableFilterPanelProps) {
  return (
    <div className="rounded-xl bg-muted p-4 space-y-4">
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          singleColumn ? "max-h-[50vh] overflow-y-auto pr-1" : "md:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {/* Filters are secondary controls: keep them outlined (forms elsewhere are filled). */}
        <InputVariantProvider value="outlined">{children}</InputVariantProvider>
      </div>
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
