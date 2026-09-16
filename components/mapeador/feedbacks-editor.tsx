"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateMapeadorEtapa } from "@/actions/mapeador"
import { useDebounce } from "@/hooks/use-debounce"
import { MAPEADOR_FEEDBACK_TIPO_LABELS, type MapeadorFeedback, type MapeadorFeedbackTipo } from "@/types/mapeador"

interface FeedbacksEditorProps {
  etapaId: string
  etapaNome: string
  projetoId: string
  feedbacks: MapeadorFeedback[]
  onChange: (feedbacks: MapeadorFeedback[]) => void
}

function newFeedback(status: string): MapeadorFeedback {
  return { feedback: status, logic: "", tipo: "positivo", botaoNoPortal: false, botaoLabel: "Acessar" }
}

export function FeedbacksEditor({ etapaId, etapaNome, projetoId, feedbacks, onChange }: FeedbacksEditorProps) {
  const [novoStatus, setNovoStatus] = useState("")
  const serialized = JSON.stringify(feedbacks)
  const debounced = useDebounce(serialized, 800)
  const firstRun = useRef(true)
  const lastSavedRef = useRef(serialized)

  useEffect(() => {
    firstRun.current = true
    lastSavedRef.current = serialized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapaId])

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (debounced === lastSavedRef.current) return
    lastSavedRef.current = debounced
    updateMapeadorEtapa(etapaId, projetoId, { feedbacks: JSON.parse(debounced) }).then((result) => {
      if (!result.success) toast.error(result.error || "Erro ao salvar feedbacks")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  function updateAt(index: number, patch: Partial<MapeadorFeedback>) {
    onChange(feedbacks.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function removeAt(index: number) {
    onChange(feedbacks.filter((_, i) => i !== index))
  }

  function handleAdd() {
    if (!novoStatus.trim()) return
    onChange([...feedbacks, newFeedback(novoStatus.trim())])
    setNovoStatus("")
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Feedbacks da etapa &quot;{etapaNome}&quot;</p>
        <p className="text-xs text-muted-foreground">
          Cada situação possível desta etapa no portal do candidato (ex.: Aprovado, Reprovado, Aguardando correção). Aparecem na timeline do protótipo, com a lógica no tooltip.
        </p>
      </div>

      {feedbacks.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="p-2 font-medium">Status exibido</th>
                <th className="p-2 font-medium">Quando aparece</th>
                <th className="p-2 font-medium">Tipo</th>
                <th className="p-2 font-medium">Botão no portal</th>
                <th className="w-8 p-2" />
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((fb, index) => (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="p-2">
                    <Input value={fb.feedback} onChange={(e) => updateAt(index, { feedback: e.target.value })} />
                  </td>
                  <td className="p-2">
                    <Input value={fb.logic} onChange={(e) => updateAt(index, { logic: e.target.value })} placeholder="Ex: Inscrição finalizada na ficha" />
                  </td>
                  <td className="p-2">
                    <Select
                      items={Object.entries(MAPEADOR_FEEDBACK_TIPO_LABELS).map(([value, label]) => ({ value, label }))}
                      value={fb.tipo}
                      onValueChange={(v) => updateAt(index, { tipo: v as MapeadorFeedbackTipo })}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MAPEADOR_FEEDBACK_TIPO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!fb.botaoNoPortal} onCheckedChange={(v) => updateAt(index, { botaoNoPortal: !!v })} />
                      <Input
                        value={fb.botaoLabel ?? ""}
                        onChange={(e) => updateAt(index, { botaoLabel: e.target.value })}
                        placeholder="Acessar"
                        disabled={!fb.botaoNoPortal}
                        className="w-32"
                      />
                    </div>
                  </td>
                  <td className="p-2">
                    <button type="button" onClick={() => removeAt(index)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-dashed p-2">
        <Input
          value={novoStatus}
          onChange={(e) => setNovoStatus(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Digite o status e Enter (ex.: Aprovado)"
          className="border-none shadow-none focus-visible:ring-0"
        />
        <button type="button" onClick={handleAdd} className="shrink-0 text-muted-foreground hover:text-foreground" title="Adicionar">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
