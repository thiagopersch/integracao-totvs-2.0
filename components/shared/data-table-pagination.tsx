"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface PageSizeSelectProps {
  pageSize: number
  onPageSizeChange: (pageSize: number) => void
}

export function PageSizeSelect({ pageSize, onPageSizeChange }: PageSizeSelectProps) {
  return (
    <Select
      items={PAGE_SIZE_OPTIONS.map((size) => ({ value: `${size}`, label: `${size} itens por página` }))}
      value={`${pageSize}`}
      onValueChange={(value) => onPageSizeChange(Number(value))}
    >
      <SelectTrigger className="h-9 w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent side="bottom">
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={`${size}`}>
            {size} itens por página
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface DataTablePaginationProps {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}

export function DataTablePagination({
  page,
  pageCount,
  total,
  onPageChange,
}: DataTablePaginationProps) {
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-4 px-2 sm:flex-row">
      <div className="text-sm text-muted-foreground">{total} registro(s) no total</div>
      <div className="flex items-center gap-4">
        <div className="flex w-[110px] items-center justify-center text-sm text-muted-foreground">
          Página {page} de {Math.max(pageCount, 1)}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(pageCount)}
            disabled={page >= pageCount}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
