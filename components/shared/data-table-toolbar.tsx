"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Filter as FilterIcon } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { useState, useEffect, useRef } from "react"
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

export function DataTableToolbar({
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

  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
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
      <div className="ml-auto flex items-center gap-2 sm:ml-0">{toolbarActions}</div>
    </div>
  )
}
