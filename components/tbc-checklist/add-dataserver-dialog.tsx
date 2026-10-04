"use client"

import { useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { PrimaryKeyInputs } from "@/components/tbc-checklist/primary-key-inputs"
import { useDataserverSchema } from "@/components/tbc-checklist/use-dataserver-schema"
import type { ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { pickKnownPkValues } from "@/lib/tbc-checklist-filtro"
import { EMPTY_CONTEXT_FORM, isRelatedDataserver, type ChecklistContextForm } from "@/lib/tbc-checklist-dataservers"
import type { SchemaTable } from "@/utils/soap-schema"
import type { Dataserver } from "@/generated/prisma/client"

interface AddDataserverDialogProps {
  tbcId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  dataservers: Dataserver[]
  loading: boolean
  /** PK values of the selected processo seletivo (e.g. CODCOLIGADA, IDPS), used to pre-fill the
   *  new Data Server's primary-key inputs whose names match. */
  knownValues: Record<string, string>
  onConfirm: (dataserver: Dataserver, context: ChecklistContext, pkValues: Record<string, string>) => void
}

export function AddDataserverDialog({
  tbcId,
  open,
  onOpenChange,
  dataservers,
  loading,
  knownValues,
  onConfirm,
}: AddDataserverDialogProps) {
  const [dataserverId, setDataserverId] = useState("")
  const [contextForm, setContextForm] = useState<ChecklistContextForm>(EMPTY_CONTEXT_FORM)
  const [pkFields, setPkFields] = useState<{ name: string; caption: string }[] | null>(null)
  const [pkValues, setPkValues] = useState<Record<string, string>>({})

  const relatedDataservers = dataservers.filter((d) => isRelatedDataserver(d.code))
  const selected = relatedDataservers.find((d) => d.id === dataserverId)

  function handleSchemaLoaded(tables: SchemaTable[]) {
    const fields = (tables[0]?.fields ?? [])
      .filter((f) => f.isPrimaryKey)
      .map((f) => ({ name: f.name, caption: f.caption && f.caption !== "-" ? f.caption : f.name }))
    setPkFields(fields)
    setPkValues(pickKnownPkValues(fields.map((f) => f.name), knownValues))
  }

  const schema = useDataserverSchema(tbcId, selected, contextForm, handleSchemaLoaded)

  function reset() {
    setDataserverId("")
    setContextForm(EMPTY_CONTEXT_FORM)
    setPkFields(null)
    setPkValues({})
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSelectDataserver(id: string) {
    setDataserverId(id)
    setPkFields(null)
    setPkValues({})
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
              items={relatedDataservers.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              value={dataserverId}
              onValueChange={handleSelectDataserver}
              placeholder="Selecione um Data Server"
              searchPlaceholder="Buscar Data Server..."
              emptyText="Nenhum Data Server relacionado cadastrado."
            />
          </Field>

          <ChecklistContextFields value={contextForm} onChange={setContextForm} />

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Chave primária (filtro)</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => void schema.refetch()}
                disabled={!selected || !schema.contextComplete || schema.loading}
                title="Buscar esquema novamente"
              >
                <RefreshCw className={schema.loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                Buscar esquema
              </Button>
            </div>
            {!selected || !schema.contextComplete ? (
              <p className="text-xs text-muted-foreground">
                Selecione o Data Server e preencha coligada, filial e tipo de curso para buscar o esquema.
              </p>
            ) : schema.loading ? (
              <div className="flex h-16 items-center justify-center rounded-md border text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando esquema...
              </div>
            ) : pkFields ? (
              <PrimaryKeyInputs fields={pkFields} values={pkValues} onChange={setPkValues} />
            ) : null}
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => selected && schema.context && onConfirm(selected, schema.context, pkValues)}
            disabled={!selected || !schema.context || !pkFields || schema.loading || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
