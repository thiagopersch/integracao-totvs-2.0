"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type { PortalProcessRef } from "@/lib/ps-docs/types"

export type Portal = { id: number; title: string }

export interface ProcessPickerProps {
  title: string
  description: string
  portals: Portal[] | null
  loadingPortals: boolean
  portalId: string
  onPortalChange: (id: string) => void
  processes: PortalProcessRef[] | null
  loadingProcesses: boolean
  psId: string
  onPsChange: (id: string) => void
  progress: { done: number; total: number } | null
  disabled?: boolean
}

/** One side of the comparison: portal first, then one of that portal's active processes. */
export function ProcessPicker(props: ProcessPickerProps) {
  const { portals, processes, progress } = props
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel>Portal *</FieldLabel>
          {props.loadingPortals ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Combobox
              items={(portals ?? []).map((p) => ({ value: String(p.id), label: `${p.title} (${p.id})` }))}
              value={props.portalId}
              onValueChange={props.onPortalChange}
              placeholder={portals ? "Selecione o portal" : "Carregue os portais"}
              disabled={props.disabled || !portals || portals.length === 0}
            />
          )}
        </Field>
        <Field>
          <FieldLabel>Processo seletivo *</FieldLabel>
          {props.loadingProcesses ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Combobox
              items={(processes ?? []).map((p) => ({ value: p.id, label: `${p.name} (${p.id})` }))}
              value={props.psId}
              onValueChange={props.onPsChange}
              placeholder={!props.portalId ? "Selecione o portal primeiro" : processes?.length === 0 ? "Nenhum processo ativo" : "Selecione o processo seletivo"}
              disabled={props.disabled || !processes || processes.length === 0}
            />
          )}
        </Field>
        {progress && (
          <Progress value={progress.total ? (progress.done / progress.total) * 100 : null}>
            <ProgressLabel>{progress.done === progress.total ? "Estrutura carregada" : "Lendo etapas..."}</ProgressLabel>
            <ProgressValue>
              {progress.done}/{progress.total}
            </ProgressValue>
          </Progress>
        )}
      </CardContent>
    </Card>
  )
}
