"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Filter as FilterIcon } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { memo, useState, useEffect, useRef } from "react"
import { cn } from "@/utils/cn"

interface DataTableToolbarProps {
  searchable?: boolean
  searchPlaceholder?: string
  searchDefaultValue?: string
  onSearch?: (value: string) => void
  toolbarActions?: React.ReactNode
  pageSizeSelect?: React.ReactNode
  hasFilterPanel?: boolean
  filtersOpen?: boolean
  onToggleFilters?: () => void
}

export const DataTableToolbar = memo(function DataTableToolbar({
  searchable = true,
  searchPlaceholder = "Buscar...",
  searchDefaultValue = "",
  onSearch,
  toolbarActions,
  pageSizeSelect,
  hasFilterPanel = false,
  filtersOpen = false,
  onToggleFilters,
}: DataTableToolbarProps) {
  const [searchValue, setSearchValue] = useState(searchDefaultValue)
  const debouncedSearch = useDebounce(searchValue, 300)

  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  })

  // Compared by value (not a "first run" flag) so StrictMode's double effect run — or a re-mount —
  // doesn't fire a spurious search, which would trigger an extra navigation/server render.
  const lastSearch = useRef(searchDefaultValue)
  useEffect(() => {
    if (debouncedSearch === lastSearch.current) return
    lastSearch.current = debouncedSearch
    onSearchRef.current?.(debouncedSearch)
  }, [debouncedSearch])

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchable && (
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="h-9 w-full sm:w-[180px] lg:w-[280px]"
        />
      )}
      {hasFilterPanel && (
        <Button
          type="button"
          variant={filtersOpen ? "secondary" : "outline"}
          size="sm"
          className={cn("h-9", filtersOpen && "border-primary")}
          onClick={onToggleFilters}
        >
          <FilterIcon className="h-4 w-4 mr-2" /> Filtro
        </Button>
      )}
      <div className="hidden flex-1 sm:block" />
      {pageSizeSelect}
      {/* Wraps onto extra rows on phones instead of pushing the page wider than the screen. */}
      <div className="flex w-full flex-wrap items-center gap-2 empty:hidden sm:ml-0 sm:w-auto">{toolbarActions}</div>
    </div>
  )
})
