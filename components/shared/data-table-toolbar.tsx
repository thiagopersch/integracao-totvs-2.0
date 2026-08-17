"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { Table } from "@tanstack/react-table"
import { useDebounce } from "@/hooks/use-debounce"
import { useState, useEffect, useRef } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  searchable?: boolean
  searchPlaceholder?: string
  onSearch?: (value: string) => void
  toolbarActions?: React.ReactNode
  filtersSlot?: React.ReactNode
  showPageSizeSelect?: boolean
}

export function DataTableToolbar<TData>({
  table,
  searchable = true,
  searchPlaceholder = "Buscar...",
  onSearch,
  toolbarActions,
  filtersSlot,
  showPageSizeSelect = true,
}: DataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = useState("")
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

  const isFiltered = table.getState().columnFilters.length > 0 || searchValue.length > 0

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center space-x-2">
        {searchable && (
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}
        {filtersSlot}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters()
              setSearchValue("")
            }}
            className="h-8 px-2 lg:px-3"
          >
            Limpar
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {toolbarActions}
        {showPageSizeSelect && (
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="bottom">
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
