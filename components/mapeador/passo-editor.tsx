"use client"

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CampoRow } from "@/components/mapeador/campo-row"
import type { MapeadorCampo, MapeadorEtapaDTO, MapeadorPasso, MapeadorPassoTipo } from "@/types/mapeador"

const PASSO_TIPO_LABELS: Record<MapeadorPassoTipo, string> = {
  passo: "Passo",
  popup: "Pop-up",
  pagina: "Página",
}

function newCampo(): MapeadorCampo {
  return { id: crypto.randomUUID(), tipo: "texto", label: "Novo campo", obrigatorio: false }
}

interface PassoEditorProps {
  passo: MapeadorPasso
  etapas: MapeadorEtapaDTO[]
  onChange: (patch: Partial<MapeadorPasso>) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
  canMoveUp: boolean
  canMoveDown: boolean
}

export function PassoEditor({ passo, etapas, onChange, onRemove, onMove, canMoveUp, canMoveDown }: PassoEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function updateCampo(campoId: string, patch: Partial<MapeadorCampo>) {
    onChange({ campos: passo.campos.map((c) => (c.id === campoId ? { ...c, ...patch } : c)) })
  }

  function removeCampo(campoId: string) {
    onChange({ campos: passo.campos.filter((c) => c.id !== campoId) })
  }

  function addCampo() {
    onChange({ campos: [...passo.campos, newCampo()] })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = passo.campos.findIndex((c) => c.id === active.id)
    const newIndex = passo.campos.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange({ campos: arrayMove(passo.campos, oldIndex, newIndex) })
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <Select items={Object.entries(PASSO_TIPO_LABELS).map(([value, label]) => ({ value, label }))} value={passo.tipo} onValueChange={(v) => onChange({ tipo: v as MapeadorPassoTipo })}>
          <SelectTrigger className="w-32 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PASSO_TIPO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={passo.titulo} onChange={(e) => onChange({ titulo: e.target.value })} placeholder="Título do passo" className="flex-1" />
        <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={!canMoveUp}>
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={!canMoveDown}>
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={passo.campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {passo.campos.map((campo) => (
              <CampoRow
                key={campo.id}
                campo={campo}
                etapas={etapas}
                passoCampos={passo.campos}
                onChange={(patch) => updateCampo(campo.id, patch)}
                onRemove={() => removeCampo(campo.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button variant="outline" size="sm" className="mt-2" onClick={addCampo}>
        <Plus className="h-3.5 w-3.5" /> Adicionar campo
      </Button>
    </div>
  )
}
