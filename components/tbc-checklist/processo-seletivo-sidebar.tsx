"use client"

import { useState } from "react"
import { Loader2, Search, Settings2, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { fetchDataserverRows } from "@/actions/integrations/tbc-checklist"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

export type ProcessoSeletivo = {
  id: string
  label: string
  row: Record<string, string>
}

interface ProcessoSeletivoSidebarProps {
  tbcId: string
  dataservers: Dataserver[]
  selectedProcesso: ProcessoSeletivo | null
  onSelectProcesso: (processo: ProcessoSeletivo | null) => void
}

export function ProcessoSeletivoSidebar({ tbcId, dataservers, selectedProcesso, onSelectProcesso }: ProcessoSeletivoSidebarProps) {
  const [configuring, setConfiguring] = useState(true)
  const [dataserverId, setDataserverId] = useState("")
  const [filtro, setFiltro] = useState("")
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<{ name: string; caption: string; isPrimaryKey: boolean }[]>([])
  const [idField, setIdField] = useState("")
  const [labelField, setLabelField] = useState("")
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [search, setSearch] = useState("")

  const selectedDataserver = dataservers.find((d) => d.id === dataserverId)

  async function handleFetch() {
    if (!selectedDataserver) return
    setLoading(true)
    const result = await fetchDataserverRows({ tbcId, dataserverCode: selectedDataserver.code, filtro })
    setLoading(false)
    if (!result.success) {
      toast.error(result.error || "Falha ao buscar processos seletivos")
      return
    }
    setFields(result.fields)
    setRows(result.rows)
    setIdField(result.fields.find((f) => f.isPrimaryKey)?.name || result.fields[0]?.name || "")
    setLabelField(result.fields.find((f) => !f.isPrimaryKey)?.name || result.fields[0]?.name || "")
  }

  function handleConfirmConfig() {
    if (!idField || !labelField) return
    setConfiguring(false)
  }

  const processos: ProcessoSeletivo[] = rows.map((row) => ({
    id: row[idField] ?? "",
    label: row[labelField] || row[idField] || "(sem nome)",
    row,
  }))
  const filteredProcessos = search.trim()
    ? processos.filter((p) => p.label.toLowerCase().includes(search.trim().toLowerCase()))
    : processos

  if (configuring) {
    return (
      <div className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto rounded-md border p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderKanban className="h-4 w-4" />
          Processos Seletivos
        </div>
        <p className="text-xs text-muted-foreground">
          Selecione o Data Server do TOTVS que representa os processos seletivos para listá-los ao vivo.
        </p>
        <Field>
          <FieldLabel>Data Server</FieldLabel>
          <Combobox
            items={dataservers.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            value={dataserverId}
            onValueChange={(v) => {
              setDataserverId(v)
              setFields([])
              setRows([])
            }}
            placeholder="Selecione um Data Server"
            searchPlaceholder="Buscar Data Server..."
            emptyText="Nenhum Data Server cadastrado."
          />
        </Field>
        <Field>
          <FieldLabel>Filtro (ReadView, opcional)</FieldLabel>
          <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="ex.: CODCOLIGADA=1" />
        </Field>
        <Button type="button" variant="outline" onClick={handleFetch} disabled={!selectedDataserver || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Buscar registros
        </Button>

        {fields.length > 0 && (
          <>
            <Field>
              <FieldLabel>Campo de identificação</FieldLabel>
              <Select items={fields.map((f) => ({ value: f.name, label: f.caption }))} value={idField} onValueChange={(v) => setIdField(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.caption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Campo de exibição (nome)</FieldLabel>
              <Select items={fields.map((f) => ({ value: f.name, label: f.caption }))} value={labelField} onValueChange={(v) => setLabelField(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.caption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">{rows.length} registro(s) encontrado(s).</p>
            <Button type="button" onClick={handleConfirmConfig} disabled={!idField || !labelField}>
              Usar esta configuração
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-[300px] shrink-0 flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderKanban className="h-4 w-4" />
          Processos Seletivos
        </div>
        <Button type="button" variant="ghost" size="icon" title="Reconfigurar" onClick={() => setConfiguring(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 pr-2">
          {filteredProcessos.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Nenhum processo seletivo encontrado.</p>
          )}
          {filteredProcessos.map((processo) => (
            <button
              key={processo.id}
              type="button"
              onClick={() => onSelectProcesso(processo)}
              className={cn(
                "rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                selectedProcesso?.id === processo.id && "bg-accent font-medium"
              )}
            >
              {processo.label}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
