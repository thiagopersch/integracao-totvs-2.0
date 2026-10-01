"use client"

import { useState } from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { MAPEADOR_DETALHE_CAMPO_TIPO_LABELS, type MapeadorDetalheCampo, type MapeadorDetalheCampoTipo } from "@/types/mapeador"

const TIPO_OPCOES = Object.entries(MAPEADOR_DETALHE_CAMPO_TIPO_LABELS)

function newDetalheCampo(): MapeadorDetalheCampo {
  return { id: crypto.randomUUID(), nome: "Novo campo", tipo: "consulta", alias: "", valorExemplo: "" }
}

interface DetalhesCamposEditorProps {
  campos: MapeadorDetalheCampo[]
  onChange: (campos: MapeadorDetalheCampo[]) => void
}

export function DetalhesCamposEditor({ campos, onChange }: DetalhesCamposEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function updateAt(id: string, patch: Partial<MapeadorDetalheCampo>) {
    onChange(campos.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeAt(id: string) {
    onChange(campos.filter((c) => c.id !== id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = campos.findIndex((c) => c.id === active.id)
    const newIndex = campos.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(campos, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {campos.map((campo) => (
              <DetalheCampoRow key={campo.id} campo={campo} onChange={(patch) => updateAt(campo.id, patch)} onRemove={() => removeAt(campo.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="outline" size="sm" onClick={() => onChange([...campos, newDetalheCampo()])}>
        <Plus className="h-3.5 w-3.5" /> Adicionar campo
      </Button>
    </div>
  )
}

interface DetalheCampoRowProps {
  campo: MapeadorDetalheCampo
  onChange: (patch: Partial<MapeadorDetalheCampo>) => void
  onRemove: () => void
}

function DetalheCampoRow({ campo, onChange, onRemove }: DetalheCampoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campo.id })
  const dragStyle = { transform: CSS.Transform.toString(transform), transition }
  const [expanded, setExpanded] = useState(false)

  return (
    <div ref={setNodeRef} style={dragStyle} className={cn("@container/detalhe-row rounded-md border bg-background p-2", isDragging && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing">
          <GripVertical className="h-4 w-4 shrink-0" />
        </button>
        <Input value={campo.nome} onChange={(e) => onChange({ nome: e.target.value })} placeholder="Nome campo" className="min-w-[120px] flex-1 @md/detalhe-row:flex-none @md/detalhe-row:w-40" />
        <Select items={TIPO_OPCOES.map(([value, label]) => ({ value, label }))} value={campo.tipo} onValueChange={(v) => onChange({ tipo: v as MapeadorDetalheCampoTipo })}>
          <SelectTrigger className="w-full @md/detalhe-row:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPO_OPCOES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={campo.alias ?? ""} onChange={(e) => onChange({ alias: e.target.value })} placeholder="Alias" className="min-w-[100px] flex-1 @md/detalhe-row:flex-none @md/detalhe-row:w-32" />
        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Recolher valor de exemplo" : "Definir valor de exemplo"}>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !expanded && "-rotate-90")} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1 border-t pt-2">
          <Label className="text-xs text-muted-foreground">Valor de exemplo</Label>
          <Input value={campo.valorExemplo ?? ""} onChange={(e) => onChange({ valorExemplo: e.target.value })} placeholder="Valor de exemplo" />
        </div>
      )}
    </div>
  )
}
