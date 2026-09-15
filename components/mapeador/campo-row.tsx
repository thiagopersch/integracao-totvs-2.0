"use client"

import { useState } from "react"
import { GripVertical, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MAPEADOR_CAMPO_TIPO_LABELS, type MapeadorCampo, type MapeadorCampoTipo, type MapeadorEtapaDTO } from "@/types/mapeador"

const LISTA_OPCOES_TIPOS: MapeadorCampoTipo[] = ["select", "radio", "check"]

interface CampoRowProps {
  campo: MapeadorCampo
  etapas: MapeadorEtapaDTO[]
  onChange: (patch: Partial<MapeadorCampo>) => void
  onRemove: () => void
}

export function CampoRow({ campo, etapas, onChange, onRemove }: CampoRowProps) {
  const [expanded, setExpanded] = useState(false)
  const mostraOpcoesLista = LISTA_OPCOES_TIPOS.includes(campo.tipo)

  return (
    <div className="rounded-md border bg-background p-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Select items={Object.entries(MAPEADOR_CAMPO_TIPO_LABELS).map(([value, label]) => ({ value, label }))} value={campo.tipo} onValueChange={(v) => onChange({ tipo: v as MapeadorCampoTipo })}>
          <SelectTrigger className="w-56 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MAPEADOR_CAMPO_TIPO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={campo.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Nome do campo" className="flex-1" />
        <Label className="flex shrink-0 items-center gap-1 text-xs">
          <Checkbox checked={!!campo.obrigatorio} onCheckedChange={(v) => onChange({ obrigatorio: !!v })} /> obrig.
        </Label>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Menos" : "Mais"}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-2 grid gap-2 border-t pt-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Condição de exibição</Label>
            <Input
              value={campo.condicaoExibicao ?? ""}
              onChange={(e) => onChange({ condicaoExibicao: e.target.value })}
              placeholder='Ex: Só aparece se "Possui deficiência" = Sim'
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ação: ir para etapa</Label>
            <Select
              items={[{ value: "__default__", label: "Padrão (próximo item)" }, ...etapas.map((e) => ({ value: e.id, label: e.nome }))]}
              value={campo.acaoDestinoEtapaId ?? "__default__"}
              onValueChange={(v) => onChange({ acaoDestinoEtapaId: v === "__default__" ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Padrão (próximo item)</SelectItem>
                {etapas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mostraOpcoesLista && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Opções da lista (separadas por vírgula)</Label>
              <Input
                value={(campo.opcoesLista ?? []).join(", ")}
                onChange={(e) =>
                  onChange({
                    opcoesLista: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Opção A, Opção B, Opção C"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
