"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2, Power, PowerOff } from "lucide-react"

interface EntityActionsCellProps {
  onEdit: () => void
  onDelete?: () => void
  editLabel?: string
  deleteLabel?: string
  extraItems?: React.ReactNode
  /** When set, renders an "Ativar"/"Desativar" item that flips the record's status without opening the edit dialog. */
  onToggleStatus?: () => void
  isActive?: boolean
}

export function EntityActionsCell({
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Excluir",
  extraItems,
  onToggleStatus,
  isActive,
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
        {onToggleStatus && (
          <DropdownMenuItem onClick={onToggleStatus}>
            {isActive ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" /> Desativar
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" /> Ativar
              </>
            )}
          </DropdownMenuItem>
        )}
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
