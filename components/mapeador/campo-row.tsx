"use client"

import { useState } from "react"
import { GripVertical, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MAPEADOR_CAMPO_TIPO_LABELS, normalizeLargura, type MapeadorCampo, type MapeadorCampoTipo, type MapeadorEtapaDTO } from "@/types/mapeador"

const LISTA_OPCOES_TIPOS: MapeadorCampoTipo[] = ["select", "radio", "check"]
const NAO_REFERENCIAVEIS: MapeadorCampoTipo[] = ["botao", "texto_informativo", "titulo_pagina", "label_destaque", "divisor", "condicional", "popup"]
const LARGURA_OPCOES = Array.from({ length: 12 }, (_, i) => 12 - i)

function condicaoLabel(refCampo: MapeadorCampo | undefined, valor: string | boolean | undefined): string {
  if (!refCampo) return ""
  if (typeof valor === "boolean") return `Só aparece se "${refCampo.label}" ${valor ? "estiver marcado" : "não estiver marcado"}`
  return `Só aparece se "${refCampo.label}" = "${valor}"`
}

interface CampoRowProps {
  campo: MapeadorCampo
  etapas: MapeadorEtapaDTO[]
  passoCampos: MapeadorCampo[]
  onChange: (patch: Partial<MapeadorCampo>) => void
  onRemove: () => void
}

export function CampoRow({ campo, etapas, passoCampos, onChange, onRemove }: CampoRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [opcoesText, setOpcoesText] = useState(() => (campo.opcoesLista ?? []).join(", "))
  const mostraOpcoesLista = LISTA_OPCOES_TIPOS.includes(campo.tipo)
  const candidatos = passoCampos.filter((c) => c.id !== campo.id && !NAO_REFERENCIAVEIS.includes(c.tipo))
  const refCampo = candidatos.find((c) => c.id === campo.condicaoRefCampoId)
  const refKind: "opcoes" | "check" | "texto" = refCampo?.opcoesLista?.length ? "opcoes" : refCampo?.tipo === "check" ? "check" : "texto"

  function applyCondicao(refCampoId: string | null, valor: string | boolean | undefined) {
    const ref = candidatos.find((c) => c.id === refCampoId)
    onChange({
      condicaoRefCampoId: refCampoId,
      condicaoRefValor: valor,
      condicaoExibicao: refCampoId ? condicaoLabel(ref, valor) : undefined,
    })
  }

  function handleRefChange(refCampoId: string) {
    const ref = candidatos.find((c) => c.id === refCampoId)
    const defaultValor: string | boolean = ref?.opcoesLista?.length ? ref.opcoesLista[0] : ref?.tipo === "check" ? true : ""
    applyCondicao(refCampoId, defaultValor)
  }

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
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Condição de exibição</Label>
              {campo.condicaoRefCampoId && (
                <button type="button" className="text-xs text-destructive hover:underline" onClick={() => applyCondicao(null, undefined)}>
                  Remover
                </button>
              )}
            </div>
            {candidatos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Adicione outro campo neste passo para poder condicionar a exibição.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Só aparece se</span>
                <Select items={candidatos.map((c) => ({ value: c.id, label: c.label }))} value={campo.condicaoRefCampoId ?? null} onValueChange={(v) => handleRefChange(v as string)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecione o campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidatos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {refCampo &&
                  (refKind === "opcoes" ? (
                    <Select items={(refCampo.opcoesLista ?? []).map((o) => ({ value: o, label: o }))} value={(campo.condicaoRefValor as string) ?? null} onValueChange={(v) => applyCondicao(refCampo.id, v as string)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(refCampo.opcoesLista ?? []).map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : refKind === "check" ? (
                    <Select
                      items={[
                        { value: "true", label: "estiver marcado" },
                        { value: "false", label: "não estiver marcado" },
                      ]}
                      value={campo.condicaoRefValor === false ? "false" : "true"}
                      onValueChange={(v) => applyCondicao(refCampo.id, v === "true")}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">estiver marcado</SelectItem>
                        <SelectItem value="false">não estiver marcado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={(campo.condicaoRefValor as string) ?? ""}
                      onChange={(e) => applyCondicao(refCampo.id, e.target.value)}
                      placeholder="Valor exato do campo"
                      className="w-44"
                    />
                  ))}
              </div>
            )}
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
          <div className="space-y-1">
            <Label className="text-xs">Largura no protótipo</Label>
            <Select
              items={LARGURA_OPCOES.map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "coluna" : "colunas"} (${Math.round((n / 12) * 100)}%)` }))}
              value={String(normalizeLargura(campo.largura))}
              onValueChange={(v) => onChange({ largura: Number(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LARGURA_OPCOES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? "coluna" : "colunas"} ({Math.round((n / 12) * 100)}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {mostraOpcoesLista && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Opções da lista (separadas por vírgula)</Label>
              <Input
                value={opcoesText}
                onChange={(e) => setOpcoesText(e.target.value)}
                onBlur={() =>
                  onChange({
                    opcoesLista: opcoesText
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
