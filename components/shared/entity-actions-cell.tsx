"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
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
      <DropdownMenuContent align="end" className="w-auto min-w-40 whitespace-nowrap">
        {onToggleStatus && (
          <DropdownMenuItem
            onClick={onToggleStatus}
            className={cn(
              "mb-1 justify-center rounded-md py-1.5 font-medium text-white focus:text-white [&_svg]:text-white",
              isActive
                ? "bg-muted-foreground focus:bg-muted-foreground/90"
                : "bg-emerald-600 focus:bg-emerald-600/90"
            )}
          >
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
