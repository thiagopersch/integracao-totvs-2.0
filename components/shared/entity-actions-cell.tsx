"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

interface EntityActionsCellProps {
  onEdit: () => void
  onDelete?: () => void
  editLabel?: string
  deleteLabel?: string
  extraItems?: React.ReactNode
}

export function EntityActionsCell({
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Excluir",
  extraItems,
}: EntityActionsCellProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent cursor-pointer">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> {editLabel}
        </DropdownMenuItem>
        {extraItems}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" /> {deleteLabel}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
