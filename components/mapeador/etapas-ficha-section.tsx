"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, ChevronDown, Copy, GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import {
  createMapeadorEtapa,
  deleteMapeadorEtapa,
  duplicateMapeadorEtapa,
  getMapeadorProjeto,
  reorderMapeadorEtapas,
  updateMapeadorEtapa,
} from "@/actions/mapeador"
import { useMapeadorStore } from "@/store/mapeador.store"
import type { MapeadorEtapaDTO } from "@/types/mapeador"

interface EtapaRowProps {
  etapa: MapeadorEtapaDTO
  index: number
  total: number
  onMove: (direction: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
  onFieldBlur: (field: "nome" | "condicao" | "regras", value: string) => void
}

function EtapaRow({ etapa, index, total, onMove, onDuplicate, onDelete, onFieldBlur }: EtapaRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className={cn("mb-3 last:mb-0", isDragging && "opacity-50")}>
      <AccordionItem value={etapa.id} className="rounded-lg border px-2">
        <div className="flex flex-wrap items-center gap-2 py-2">
          <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-5 text-center text-sm text-muted-foreground">{index + 1}</span>
          <Input
            defaultValue={etapa.nome}
            onBlur={(e) => onFieldBlur("nome", e.target.value)}
            placeholder="Nome da etapa"
            className="min-w-[180px] flex-[2]"
          />
          <Input
            defaultValue={etapa.condicao ?? ""}
            onBlur={(e) => onFieldBlur("condicao", e.target.value)}
            placeholder="Condição para liberar a etapa"
            className="min-w-[240px] flex-[3]"
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
            <AccordionTrigger className="w-8 flex-none cursor-pointer justify-center p-1.5 hover:no-underline [&>svg]:mx-0" title="Regras/Validações">
              <ChevronDown className="sr-only" />
            </AccordionTrigger>
          </div>
        </div>
        <AccordionContent className="pb-3">
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs text-muted-foreground">Regras/Validações</Label>
            <Textarea
              defaultValue={etapa.regras ?? ""}
              placeholder="Regras/validações"
              rows={3}
              onBlur={(e) => onFieldBlur("regras", e.target.value)}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}

export function EtapasFichaSection() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const setEtapas = useMapeadorStore((s) => s.setEtapas)
  const selectedEtapaId = useMapeadorStore((s) => s.selectedEtapaId)
  const setSelectedEtapaId = useMapeadorStore((s) => s.setSelectedEtapaId)
  const [novaEtapaNome, setNovaEtapaNome] = useState("")
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  async function refreshEtapas(preferSelect?: string) {
    const fresh = await getMapeadorProjeto(projeto.id)
    if (!fresh) return
    setEtapas(fresh.etapas)
    if (preferSelect) setSelectedEtapaId(preferSelect)
    else if (!fresh.etapas.some((e) => e.id === selectedEtapaId)) setSelectedEtapaId(fresh.etapas[0]?.id ?? null)
  }

  async function persistOrder(etapas: MapeadorEtapaDTO[]) {
    const result = await reorderMapeadorEtapas(
      projeto.id,
      etapas.map((e) => e.id)
    )
    if (!result.success) {
      toast.error(result.error || "Erro ao reordenar")
      await refreshEtapas()
    }
  }

  async function handleAddEtapa() {
    if (!novaEtapaNome.trim()) return
    const result = await createMapeadorEtapa(projeto.id, novaEtapaNome.trim())
    if (!result.success) return toast.error(result.error || "Erro ao criar etapa")
    setNovaEtapaNome("")
    await refreshEtapas(result.data.id)
  }

  async function handleDuplicate(etapaId: string) {
    const result = await duplicateMapeadorEtapa(etapaId, projeto.id)
    if (!result.success) return toast.error(result.error || "Erro ao duplicar etapa")
    await refreshEtapas(result.data.id)
  }

  async function handleDelete(etapaId: string) {
    if (!confirm("Excluir esta etapa?")) return
    const result = await deleteMapeadorEtapa(etapaId, projeto.id)
    if (!result.success) return toast.error(result.error || "Erro ao excluir etapa")
    await refreshEtapas()
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const etapas = [...projeto.etapas]
    const target = index + direction
    if (target < 0 || target >= etapas.length) return
    ;[etapas[index], etapas[target]] = [etapas[target], etapas[index]]
    const reordered = etapas.map((e, i) => ({ ...e, ordem: i + 1 }))
    setEtapas(reordered)
    await persistOrder(reordered)
  }

  async function handleFieldBlur(etapa: MapeadorEtapaDTO, field: "nome" | "condicao" | "regras", value: string) {
    const result = await updateMapeadorEtapa(etapa.id, projeto.id, { [field]: value })
    if (!result.success) toast.error(result.error || "Erro ao salvar etapa")
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = projeto.etapas.findIndex((e) => e.id === active.id)
    const newIndex = projeto.etapas.findIndex((e) => e.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(projeto.etapas, oldIndex, newIndex).map((e, i) => ({ ...e, ordem: i + 1 }))
    setEtapas(reordered)
    persistOrder(reordered)
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={projeto.etapas.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <Accordion multiple>
            {projeto.etapas.map((etapa, index) => (
              <EtapaRow
                key={etapa.id}
                etapa={etapa}
                index={index}
                total={projeto.etapas.length}
                onMove={(direction) => handleMove(index, direction)}
                onDuplicate={() => handleDuplicate(etapa.id)}
                onDelete={() => handleDelete(etapa.id)}
                onFieldBlur={(field, value) => handleFieldBlur(etapa, field, value)}
              />
            ))}
          </Accordion>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex gap-2">
        <Input
          placeholder="Nome da nova etapa"
          value={novaEtapaNome}
          onChange={(e) => setNovaEtapaNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddEtapa()}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={handleAddEtapa} disabled={!novaEtapaNome.trim()}>
          <Plus className="h-4 w-4" /> Adicionar etapa
        </Button>
      </div>
    </div>
  )
}
