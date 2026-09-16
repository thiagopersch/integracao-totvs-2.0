"use client"

import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AlignCenter, AlignLeft, AlignRight, GripVertical, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { colunaContainerId } from "@/lib/mapeador/campo-containers"
import { MAPEADOR_CAMPO_TIPO_LABELS, normalizeLargura, type MapeadorCampo, type MapeadorCampoTipo, type MapeadorColuna, type MapeadorEtapaDTO } from "@/types/mapeador"

const LISTA_OPCOES_TIPOS: MapeadorCampoTipo[] = ["select", "radio", "check"]
const TEXTO_ESTILIZAVEL_TIPOS: MapeadorCampoTipo[] = ["titulo_pagina", "label_destaque", "texto_informativo"]
const ALINHAMENTO_OPCOES = [
  { value: "left", label: "Esquerda", icon: AlignLeft },
  { value: "center", label: "Centro", icon: AlignCenter },
  { value: "right", label: "Direita", icon: AlignRight },
] as const
const NAO_REFERENCIAVEIS: MapeadorCampoTipo[] = ["botao", "texto_informativo", "titulo_pagina", "label_destaque", "divisor", "condicional", "popup", "agrupamento"]
const LARGURA_OPCOES = Array.from({ length: 12 }, (_, i) => 12 - i)
const MAX_COLUNAS = 4

function newColuna(): MapeadorColuna {
  return { id: crypto.randomUUID(), largura: 6, campos: [] }
}

function newCampoFilho(): MapeadorCampo {
  return { id: crypto.randomUUID(), tipo: "texto", label: "Novo campo", obrigatorio: false }
}

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
  /** false inside a coluna's campo list — an agrupamento cannot nest inside another agrupamento. */
  allowAgrupamento?: boolean
}

export function CampoRow({ campo, etapas, passoCampos, onChange, onRemove, allowAgrupamento = true }: CampoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: campo.id })
  const dragStyle = { transform: CSS.Transform.toString(transform), transition }
  const [expanded, setExpanded] = useState(false)
  const [opcoesText, setOpcoesText] = useState(() => (campo.opcoesLista ?? []).join(", "))
  const mostraOpcoesLista = LISTA_OPCOES_TIPOS.includes(campo.tipo)
  const mostraEstiloTexto = TEXTO_ESTILIZAVEL_TIPOS.includes(campo.tipo)
  const mostraColunas = campo.tipo === "agrupamento"
  const colunas = campo.colunas ?? []
  const candidatos = passoCampos.filter((c) => c.id !== campo.id && !NAO_REFERENCIAVEIS.includes(c.tipo))
  const refCampo = candidatos.find((c) => c.id === campo.condicaoRefCampoId)
  const refKind: "opcoes" | "check" | "texto" = refCampo?.opcoesLista?.length ? "opcoes" : refCampo?.tipo === "check" ? "check" : "texto"
  const tipoOpcoes = allowAgrupamento
    ? Object.entries(MAPEADOR_CAMPO_TIPO_LABELS)
    : Object.entries(MAPEADOR_CAMPO_TIPO_LABELS).filter(([value]) => value !== "agrupamento")

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

  function addColuna() {
    if (colunas.length >= MAX_COLUNAS) return
    onChange({ colunas: [...colunas, newColuna()] })
  }

  function removeColuna(colunaId: string) {
    if (colunas.length <= 1) return
    onChange({ colunas: colunas.filter((c) => c.id !== colunaId) })
  }

  function updateColuna(colunaId: string, patch: Partial<MapeadorColuna>) {
    onChange({ colunas: colunas.map((c) => (c.id === colunaId ? { ...c, ...patch } : c)) })
  }

  function setColunaCampos(colunaId: string, campos: MapeadorCampo[]) {
    updateColuna(colunaId, { campos })
  }

  return (
    <div ref={setNodeRef} style={dragStyle} className={cn("rounded-md border bg-background p-2", isDragging && "opacity-50")}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </button>
        <Select items={tipoOpcoes.map(([value, label]) => ({ value, label }))} value={campo.tipo} onValueChange={(v) => onChange({ tipo: v as MapeadorCampoTipo, colunas: v === "agrupamento" ? (campo.colunas ?? [newColuna()]) : campo.colunas })}>
          <SelectTrigger className="w-56 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tipoOpcoes.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={campo.label} onChange={(e) => onChange({ label: e.target.value })} placeholder={mostraColunas ? "Nome do agrupamento (uso interno)" : "Nome do campo"} className="flex-1" />
        {!mostraColunas && (
          <Label className="flex shrink-0 items-center gap-1 text-xs">
            <Checkbox checked={!!campo.obrigatorio} onCheckedChange={(v) => onChange({ obrigatorio: !!v })} /> obrig.
          </Label>
        )}
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
          {!mostraColunas && (
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
          )}
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
          {mostraEstiloTexto && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Alinhamento do texto</Label>
                <div className="flex overflow-hidden rounded-md border">
                  {ALINHAMENTO_OPCOES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      className={cn(
                        "flex flex-1 items-center justify-center py-1.5",
                        (campo.alinhamento ?? "left") === value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                      )}
                      onClick={() => onChange({ alinhamento: value })}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cor do texto</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={campo.cor || "#2b2b3c"} onChange={(e) => onChange({ cor: e.target.value })} className="h-8 w-14 p-1" />
                  {campo.cor && (
                    <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => onChange({ cor: undefined })}>
                      Redefinir
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          {mostraColunas && (
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Colunas ({colunas.length}/{MAX_COLUNAS})</Label>
                <Button variant="outline" size="sm" onClick={addColuna} disabled={colunas.length >= MAX_COLUNAS}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar coluna
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {colunas.map((coluna) => (
                  <div key={coluna.id} className="min-w-[240px] flex-1 space-y-2 rounded-md border bg-muted/30 p-2">
                    <div className="flex items-center gap-2">
                      <Select
                        items={LARGURA_OPCOES.map((n) => ({ value: String(n), label: `${n} (${Math.round((n / 12) * 100)}%)` }))}
                        value={String(normalizeLargura(coluna.largura))}
                        onValueChange={(v) => updateColuna(coluna.id, { largura: Number(v) })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LARGURA_OPCOES.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} ({Math.round((n / 12) * 100)}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeColuna(coluna.id)} disabled={colunas.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <ColunaCamposArea
                      coluna={coluna}
                      etapas={etapas}
                      onCamposChange={(campos) => setColunaCampos(coluna.id, campos)}
                    />

                    <Button variant="outline" size="sm" onClick={() => setColunaCampos(coluna.id, [...coluna.campos, newCampoFilho()])}>
                      <Plus className="h-3.5 w-3.5" /> Adicionar campo
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ColunaCamposAreaProps {
  coluna: MapeadorColuna
  etapas: MapeadorEtapaDTO[]
  onCamposChange: (campos: MapeadorCampo[]) => void
}

/**
 * A coluna's own droppable+sortable region. `useDroppable` (not just `SortableContext`) is what
 * keeps an *empty* coluna a valid drag target — a `SortableContext` with zero items has no sortable
 * node for `over` to hit-test against. Deliberately has no `DndContext` of its own: it's meant to be
 * rendered under the single shared `DndContext` in passo-editor.tsx, so campos can be dragged between
 * this coluna, other colunas, and the passo's top-level list.
 */
function ColunaCamposArea({ coluna, etapas, onCamposChange }: ColunaCamposAreaProps) {
  const { setNodeRef } = useDroppable({ id: colunaContainerId(coluna.id) })

  return (
    <SortableContext items={coluna.campos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="min-h-[40px] space-y-2">
        {coluna.campos.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Arraste um campo para cá</div>
        ) : (
          coluna.campos.map((campoFilho) => (
            <CampoRow
              key={campoFilho.id}
              campo={campoFilho}
              etapas={etapas}
              passoCampos={coluna.campos}
              allowAgrupamento={false}
              onChange={(patch) => onCamposChange(coluna.campos.map((c) => (c.id === campoFilho.id ? { ...c, ...patch } : c)))}
              onRemove={() => onCamposChange(coluna.campos.filter((c) => c.id !== campoFilho.id))}
            />
          ))
        )}
      </div>
    </SortableContext>
  )
}
