"use client"

import { useDraggable } from "@dnd-kit/core"
import { Box, Columns3, Image as ImageIcon, RectangleHorizontal, SeparatorHorizontal, Table2, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { BLOCK_TYPE_LABELS, type BlockType } from "@/lib/message-templates/block-types"

export type PaletteBlockType = Exclude<BlockType, "column">

export const PALETTE_ITEMS: { type: PaletteBlockType; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { type: "text", icon: Type, hint: "Parágrafos, títulos, listas e variáveis" },
  { type: "image", icon: ImageIcon, hint: "Logo, banner ou ilustração" },
  { type: "row", icon: Columns3, hint: "Até 6 colunas lado a lado" },
  { type: "container", icon: Box, hint: "Caixa com fundo, borda e espaçamento" },
  { type: "table", icon: Table2, hint: "Dados em linhas e colunas" },
  { type: "button", icon: RectangleHorizontal, hint: "Chamada para ação com link" },
  { type: "divider", icon: SeparatorHorizontal, hint: "Linha separadora" },
]

export function BlockTypeCard({ type, dragging }: { type: PaletteBlockType; dragging?: boolean }) {
  const item = PALETTE_ITEMS.find((i) => i.type === type)!
  const Icon = item.icon
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-xs",
        dragging && "cursor-grabbing shadow-lg ring-2 ring-primary/40"
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {BLOCK_TYPE_LABELS[type]}
    </div>
  )
}

function PaletteItem({ type, onAdd }: { type: PaletteBlockType; onAdd: (type: PaletteBlockType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: "palette", blockType: type },
  })
  const item = PALETTE_ITEMS.find((i) => i.type === type)!
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={`${item.hint} — arraste para o canvas ou clique para adicionar ao final`}
      onClick={() => onAdd(type)}
      className={cn("cursor-grab touch-none transition-opacity hover:[&>div]:border-primary/50", isDragging && "opacity-40")}
    >
      <BlockTypeCard type={type} />
    </div>
  )
}

export function BlockPalette({ onAdd }: { onAdd: (type: PaletteBlockType) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Elementos</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-1">
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem key={item.type} type={item.type} onAdd={onAdd} />
        ))}
      </div>
      <p className="pt-1 text-xs text-muted-foreground">Arraste um elemento para o canvas ou clique para adicioná-lo ao final.</p>
    </div>
  )
}
