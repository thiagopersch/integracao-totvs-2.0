"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateMapeadorInformacoesAdicionais } from "@/actions/mapeador"
import { useMapeadorStore } from "@/store/mapeador.store"
import { toast } from "sonner"

const CAMPOS = [
  ["idProcessoSeletivo", "Identificador (ID) do Processo Seletivo"],
  ["idRelatorioContrato", "Identificador (ID) do relatório do contrato"],
  ["classificacaoConvocacao", "Classificação/Convocação"],
  ["criterioClassificacao", "Critério para classificação"],
  ["agendamento", "Agendamento"],
] as const

const CLASSIFICACAO_CONVOCACAO_GRUPOS = [
  {
    label: "TOTVS",
    items: [
      { value: "TOTVS | Manual pela IEs", label: "TOTVS | Manual pela IEs" },
      { value: "TOTVS | Automática por nota", label: "TOTVS | Automática por nota" },
      { value: "TOTVS | Automática ao concluir etapa anterior", label: "TOTVS | Automática ao concluir etapa anterior" },
    ],
  },
  {
    label: "Fluxo de automação",
    items: [
      { value: "Fluxo de automação | Automática por nota", label: "Fluxo de automação | Automática por nota" },
      { value: "Fluxo de automação | Automática ao concluir etapa anterior", label: "Fluxo de automação | Automática ao concluir etapa anterior" },
    ],
  },
]

const AGENDAMENTO_OPCOES = [
  { value: "Rubeus | App Agenda", label: "Rubeus | App Agenda" },
  { value: "TOTVS | Agendamento nativo", label: "TOTVS | Agendamento nativo" },
  { value: "Não", label: "Não" },
]

const SELECT_CAMPOS: Record<string, typeof AGENDAMENTO_OPCOES | typeof CLASSIFICACAO_CONVOCACAO_GRUPOS> = {
  classificacaoConvocacao: CLASSIFICACAO_CONVOCACAO_GRUPOS,
  agendamento: AGENDAMENTO_OPCOES,
}

export function InformacoesAdicionaisTab() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const patchInformacoesAdicionais = useMapeadorStore((s) => s.patchInformacoesAdicionais)

  async function handleSave(field: string, value: string) {
    patchInformacoesAdicionais({ [field]: value })
    const result = await updateMapeadorInformacoesAdicionais(projeto.id, {
      ...projeto.informacoesAdicionais,
      [field]: value,
    })
    if (!result.success) toast.error(result.error || "Erro ao salvar informações adicionais")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações adicionais</CardTitle>
        <CardDescription>Dados de apoio do processo, sem relação direta com um campo específico.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(([field, label]) => {
          const grupos = SELECT_CAMPOS[field]
          return (
            <div key={field} className="space-y-1">
              <Label>{label}</Label>
              {grupos ? (
                <Select
                  items={grupos}
                  value={projeto.informacoesAdicionais[field] ?? ""}
                  onValueChange={(v) => handleSave(field, v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— selecionar —" />
                  </SelectTrigger>
                  <SelectContent>
                    {"items" in grupos[0] ? (
                      (grupos as typeof CLASSIFICACAO_CONVOCACAO_GRUPOS).map((grupo) => (
                        <SelectGroup key={grupo.label}>
                          <SelectLabel>{grupo.label}</SelectLabel>
                          {grupo.items.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    ) : (
                      (grupos as typeof AGENDAMENTO_OPCOES).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  defaultValue={projeto.informacoesAdicionais[field] ?? ""}
                  onBlur={(e) => handleSave(field, e.target.value)}
                />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
