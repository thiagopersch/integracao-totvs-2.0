"use client"

import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CampoRow } from "@/components/mapeador/campo-row"
import { allContainerIds, findContainerOf, getContainer, ROOT_CONTAINER, setContainer } from "@/lib/mapeador/campo-containers"
import { MAPEADOR_CAMPO_TIPO_LABELS, type MapeadorCampo, type MapeadorEtapaDTO, type MapeadorPasso, type MapeadorPassoTipo } from "@/types/mapeador"

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

/** pointerWithin alone reliably hit-tests empty droppable containers (e.g. an empty coluna); closestCenter is the fallback for when the pointer isn't over any droppable yet. Standard combo for dnd-kit's multi-container sortable pattern. */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

export function PassoEditor({ passo, etapas, onChange, onRemove, onMove, canMoveUp, canMoveDown }: PassoEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeCampo, setActiveCampo] = useState<MapeadorCampo | null>(null)
  const { setNodeRef: setRootRef } = useDroppable({ id: ROOT_CONTAINER })

  function updateCampo(campoId: string, patch: Partial<MapeadorCampo>) {
    onChange({ campos: passo.campos.map((c) => (c.id === campoId ? { ...c, ...patch } : c)) })
  }

  function removeCampo(campoId: string) {
    onChange({ campos: passo.campos.filter((c) => c.id !== campoId) })
  }

  function addCampo() {
    onChange({ campos: [...passo.campos, newCampo()] })
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id)
    const container = findContainerOf(passo.campos, activeId)
    setActiveCampo(container ? (getContainer(passo.campos, container).find((c) => c.id === activeId) ?? null) : null)
  }

  /** Live-moves the dragged campo across containers (root <-> coluna, coluna <-> coluna) as it crosses a boundary, so the item visually relocates while still being dragged — the standard dnd-kit multi-container pattern. */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const activeContainer = findContainerOf(passo.campos, activeId)
    const overContainer = allContainerIds(passo.campos).includes(overId) ? overId : findContainerOf(passo.campos, overId)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    const activeItem = getContainer(passo.campos, activeContainer).find((c) => c.id === activeId)
    if (!activeItem) return
    // An agrupamento can never nest inside a coluna.
    if (activeItem.tipo === "agrupamento" && overContainer !== ROOT_CONTAINER) return

    const sourceItems = getContainer(passo.campos, activeContainer).filter((c) => c.id !== activeId)
    const destItems = getContainer(passo.campos, overContainer)
    const overIndex = destItems.findIndex((c) => c.id === overId)
    const insertAt = overIndex >= 0 ? overIndex : destItems.length
    const nextDest = [...destItems.slice(0, insertAt), activeItem, ...destItems.slice(insertAt)]

    let nextCampos = setContainer(passo.campos, activeContainer, sourceItems)
    nextCampos = setContainer(nextCampos, overContainer, nextDest)
    onChange({ campos: nextCampos })
  }

  /** Same-container index fix once the drag settles — cross-container moves already happened live in onDragOver. */
  function handleDragEnd(event: DragEndEvent) {
    setActiveCampo(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const container = findContainerOf(passo.campos, activeId)
    if (!container) return
    const items = getContainer(passo.campos, container)
    const oldIndex = items.findIndex((c) => c.id === activeId)
    const newIndex = allContainerIds(passo.campos).includes(overId) ? items.length - 1 : items.findIndex((c) => c.id === overId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
    onChange({ campos: setContainer(passo.campos, container, arrayMove(items, oldIndex, newIndex)) })
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

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={passo.campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div ref={setRootRef} className="space-y-3">
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
        <DragOverlay>
          {activeCampo && (
            <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-lg">
              <span className="font-medium">{activeCampo.label || "Campo"}</span>
              <span className="ml-2 text-xs text-muted-foreground">{MAPEADOR_CAMPO_TIPO_LABELS[activeCampo.tipo]}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Button variant="outline" size="sm" className="mt-2" onClick={addCampo}>
        <Plus className="h-3.5 w-3.5" /> Adicionar campo
      </Button>
    </div>
  )
}
