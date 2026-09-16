"use client"

import { useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CodeEditor } from "@/components/shared/code-editor"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { fetchDataserverSchema, type ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { buildDefaultFiltro } from "@/lib/tbc-checklist-filtro"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

interface AddDataserverDialogProps {
  tbcId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  dataservers: Dataserver[]
  loading: boolean
  context: ChecklistContext
  onContextChange: (context: ChecklistContext) => void
  /** Field values already known from the selected processo seletivo (its own row plus
   *  CODCOLIGADA/CODFILIAL/CODTIPOCURSO from context), used to pre-fill the new Data Server's
   *  filtro with real values instead of a blank template. */
  knownValues: Record<string, string>
  onConfirm: (dataserver: Dataserver, filtro: string) => void
}

export function AddDataserverDialog({
  tbcId,
  open,
  onOpenChange,
  dataservers,
  loading,
  context,
  onContextChange,
  knownValues,
  onConfirm,
}: AddDataserverDialogProps) {
  const [dataserverId, setDataserverId] = useState("")
  const [filtro, setFiltro] = useState("")
  const [schemaLoading, setSchemaLoading] = useState(false)

  const selected = dataservers.find((d) => d.id === dataserverId)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setDataserverId("")
      setFiltro("")
    }
    onOpenChange(next)
  }

  async function handleFetchSchema(dataserver: Dataserver) {
    setSchemaLoading(true)
    const result = await fetchDataserverSchema({ tbcId, dataserverCode: dataserver.code, context })
    setSchemaLoading(false)
    if (!result.success) {
      toast.error(result.error || `Falha ao buscar schema do Data Server "${dataserver.name}"`)
      return
    }
    setFiltro(buildDefaultFiltro(result.tables, knownValues))
  }

  async function handleSelectDataserver(id: string) {
    setDataserverId(id)
    setFiltro("")
    const dataserver = dataservers.find((d) => d.id === id)
    if (!dataserver) return
    await handleFetchSchema(dataserver)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Data Server</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>Data Server</FieldLabel>
            <Combobox
              items={dataservers.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              value={dataserverId}
              onValueChange={handleSelectDataserver}
              placeholder="Selecione um Data Server"
              searchPlaceholder="Buscar Data Server..."
              emptyText="Nenhum Data Server cadastrado."
            />
          </Field>

          <Accordion defaultValue={[]}>
            <AccordionItem value="filtro">
              <AccordionTrigger>Contexto e filtro (ReadView)</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <ChecklistContextFields value={context} onChange={onContextChange} />
                <Field>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Filtro (condição SQL, ex.: TABELA.CAMPO = &apos;valor&apos;)</FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => selected && handleFetchSchema(selected)}
                      disabled={!selected || schemaLoading}
                      title="Buscar esquema novamente (ex.: após ajustar coligada/filial)"
                    >
                      <RefreshCw className={schemaLoading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                      Buscar esquema
                    </Button>
                  </div>
                  {schemaLoading ? (
                    <div className="flex h-[100px] items-center justify-center rounded-md border text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando schema...
                    </div>
                  ) : (
                    <CodeEditor value={filtro} onChange={setFiltro} language="sql" minHeight="100px" resetKey={dataserverId} />
                  )}
                </Field>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => selected && onConfirm(selected, filtro)} disabled={!selected || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
