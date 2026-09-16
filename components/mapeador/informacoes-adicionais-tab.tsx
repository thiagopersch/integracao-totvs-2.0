"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

export function InformacoesAdicionaisTab() {
  const projeto = useMapeadorStore((s) => s.projeto)!
  const patchInformacoesAdicionais = useMapeadorStore((s) => s.patchInformacoesAdicionais)

  async function handleBlur(field: string, value: string) {
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
        {CAMPOS.map(([field, label]) => (
          <div key={field} className="space-y-1">
            <Label>{label}</Label>
            <Input
              defaultValue={projeto.informacoesAdicionais[field] ?? ""}
              onBlur={(e) => {
                patchInformacoesAdicionais({ [field]: e.target.value })
                handleBlur(field, e.target.value)
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
