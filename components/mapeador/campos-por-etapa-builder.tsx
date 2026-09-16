"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateMapeadorEtapa } from "@/actions/mapeador"
import { useMapeadorStore } from "@/store/mapeador.store"
import { useDebounce } from "@/hooks/use-debounce"
import { PassoEditor } from "@/components/mapeador/passo-editor"
import { FeedbacksEditor } from "@/components/mapeador/feedbacks-editor"
import type { MapeadorFeedback, MapeadorPasso } from "@/types/mapeador"

function newPasso(): MapeadorPasso {
  return { id: crypto.randomUUID(), tipo: "passo", titulo: `Passo`, campos: [] }
}

export function CamposPorEtapaBuilder() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const selectedEtapaId = useMapeadorStore((s) => s.selectedEtapaId)
  const setSelectedEtapaId = useMapeadorStore((s) => s.setSelectedEtapaId)
  const setCamposPorEtapa = useMapeadorStore((s) => s.setCamposPorEtapa)
  const patchEtapa = useMapeadorStore((s) => s.patchEtapa)

  const etapa = projeto.etapas.find((e) => e.id === selectedEtapaId) ?? projeto.etapas[0] ?? null
  const serialized = JSON.stringify(etapa?.camposPorEtapa ?? [])
  const debounced = useDebounce(serialized, 800)
  const firstRun = useRef(true)
  const lastSavedRef = useRef(serialized)

  useEffect(() => {
    firstRun.current = true
    lastSavedRef.current = serialized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa?.id])

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (!etapa || debounced === lastSavedRef.current) return
    lastSavedRef.current = debounced
    updateMapeadorEtapa(etapa.id, projeto.id, { camposPorEtapa: JSON.parse(debounced) }).then((result) => {
      if (!result.success) toast.error(result.error || "Erro ao salvar campos da etapa")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  if (!etapa) {
    return <p className="text-sm text-muted-foreground">Adicione uma etapa acima para começar a montar os campos.</p>
  }

  function updatePasso(passoId: string, patch: Partial<MapeadorPasso>) {
    setCamposPorEtapa(
      etapa!.id,
      etapa!.camposPorEtapa.map((p) => (p.id === passoId ? { ...p, ...patch } : p))
    )
  }

  function removePasso(passoId: string) {
    setCamposPorEtapa(etapa!.id, etapa!.camposPorEtapa.filter((p) => p.id !== passoId))
  }

  function movePasso(index: number, direction: -1 | 1) {
    const passos = [...etapa!.camposPorEtapa]
    const target = index + direction
    if (target < 0 || target >= passos.length) return
    ;[passos[index], passos[target]] = [passos[target], passos[index]]
    setCamposPorEtapa(etapa!.id, passos)
  }

  function addPasso() {
    setCamposPorEtapa(etapa!.id, [...etapa!.camposPorEtapa, newPasso()])
  }

  function updateFeedbacks(feedbacks: MapeadorFeedback[]) {
    patchEtapa(etapa!.id, { feedbacks })
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-1">
        {projeto.etapas.map((e, i) => (
          <button
            key={e.id}
            onClick={() => setSelectedEtapaId(e.id)}
            className={cn(
              "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              e.id === etapa.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {i + 1}. {e.nome}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {etapa.camposPorEtapa.map((passo, index) => (
          <PassoEditor
            key={passo.id}
            passo={passo}
            etapas={projeto.etapas}
            onChange={(patch) => updatePasso(passo.id, patch)}
            onRemove={() => removePasso(passo.id)}
            onMove={(direction) => movePasso(index, direction)}
            canMoveUp={index > 0}
            canMoveDown={index < etapa.camposPorEtapa.length - 1}
          />
        ))}
        <Button variant="outline" size="sm" onClick={addPasso}>
          <Plus className="h-3.5 w-3.5" /> Adicionar passo
        </Button>

        <div className="border-t pt-4">
          <FeedbacksEditor etapaId={etapa.id} etapaNome={etapa.nome} projetoId={projeto.id} feedbacks={etapa.feedbacks} onChange={updateFeedbacks} />
        </div>
      </div>
    </div>
  )
}
