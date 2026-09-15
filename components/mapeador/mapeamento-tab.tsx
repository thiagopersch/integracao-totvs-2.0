"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import {
  createMapeadorEtapa,
  deleteMapeadorEtapa,
  duplicateMapeadorEtapa,
  getMapeadorProjeto,
  reorderMapeadorEtapas,
  updateMapeadorEtapa,
  updateMapeadorInformacoesAdicionais,
} from "@/actions/mapeador"
import { useMapeadorStore } from "@/store/mapeador.store"
import { CamposPorEtapaBuilder } from "@/components/mapeador/campos-por-etapa-builder"
import type { MapeadorEtapaDTO } from "@/types/mapeador"

export function MapeamentoTab() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const setEtapas = useMapeadorStore((s) => s.setEtapas)
  const selectedEtapaId = useMapeadorStore((s) => s.selectedEtapaId)
  const setSelectedEtapaId = useMapeadorStore((s) => s.setSelectedEtapaId)
  const patchInformacoesAdicionais = useMapeadorStore((s) => s.patchInformacoesAdicionais)
  const [novaEtapaNome, setNovaEtapaNome] = useState("")

  async function refreshEtapas(preferSelect?: string) {
    const fresh = await getMapeadorProjeto(projeto.id)
    if (!fresh) return
    setEtapas(fresh.etapas)
    if (preferSelect) setSelectedEtapaId(preferSelect)
    else if (!fresh.etapas.some((e) => e.id === selectedEtapaId)) setSelectedEtapaId(fresh.etapas[0]?.id ?? null)
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
    setEtapas(etapas.map((e, i) => ({ ...e, ordem: i + 1 })))
    const result = await reorderMapeadorEtapas(
      projeto.id,
      etapas.map((e) => e.id)
    )
    if (!result.success) {
      toast.error(result.error || "Erro ao reordenar")
      await refreshEtapas()
    }
  }

  async function handleFieldBlur(etapa: MapeadorEtapaDTO, field: "nome" | "condicao" | "regras", value: string) {
    const result = await updateMapeadorEtapa(etapa.id, projeto.id, { [field]: value })
    if (!result.success) toast.error(result.error || "Erro ao salvar etapa")
  }

  async function handleInfoBlur(field: string, value: string) {
    const result = await updateMapeadorInformacoesAdicionais(projeto.id, {
      ...projeto.informacoesAdicionais,
      [field]: value,
    })
    if (!result.success) toast.error(result.error || "Erro ao salvar informações adicionais")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Etapas da ficha</CardTitle>
          <CardDescription>A ordem aqui define a ordem das colunas no visualizador e do stepper no protótipo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Ordem</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Condição para liberar a etapa</TableHead>
                <TableHead>Regras/Validações</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projeto.etapas.map((etapa, index) => (
                <TableRow key={etapa.id} data-state={selectedEtapaId === etapa.id ? "selected" : undefined}>
                  <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <Input
                      defaultValue={etapa.nome}
                      onBlur={(e) => handleFieldBlur(etapa, "nome", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={etapa.condicao ?? ""}
                      placeholder="Condição para liberar a etapa"
                      onBlur={(e) => handleFieldBlur(etapa, "condicao", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      defaultValue={etapa.regras ?? ""}
                      placeholder="Regras/validações"
                      rows={1}
                      className="min-h-8"
                      onBlur={(e) => handleFieldBlur(etapa, "regras", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleMove(index, -1)} disabled={index === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleMove(index, 1)} disabled={index === projeto.etapas.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDuplicate(etapa.id)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(etapa.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações adicionais</CardTitle>
          <CardDescription>Dados de apoio do processo, sem relação direta com um campo específico.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["idProcessoSeletivo", "Identificador (ID) do Processo Seletivo"],
              ["idRelatorioContrato", "Identificador (ID) do relatório do contrato"],
              ["classificacaoConvocacao", "Classificação/Convocação"],
              ["criterioClassificacao", "Critério para classificação"],
              ["agendamento", "Agendamento"],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="space-y-1">
              <Label>{label}</Label>
              <Input
                defaultValue={projeto.informacoesAdicionais[field] ?? ""}
                onBlur={(e) => {
                  patchInformacoesAdicionais({ [field]: e.target.value })
                  handleInfoBlur(field, e.target.value)
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campos por etapa</CardTitle>
          <CardDescription>Selecione a etapa e monte os passos com os campos, botões, pop-ups e textos informativos da tela.</CardDescription>
        </CardHeader>
        <CardContent>
          <CamposPorEtapaBuilder />
        </CardContent>
      </Card>
    </div>
  )
}
