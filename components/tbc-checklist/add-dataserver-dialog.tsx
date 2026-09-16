"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type { Dataserver } from "@/generated/prisma/client"

interface AddDataserverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataservers: Dataserver[]
  loading: boolean
  onConfirm: (dataserver: Dataserver, filtro: string) => void
}

export function AddDataserverDialog({ open, onOpenChange, dataservers, loading, onConfirm }: AddDataserverDialogProps) {
  const [dataserverId, setDataserverId] = useState("")
  const [filtro, setFiltro] = useState("")

  const selected = dataservers.find((d) => d.id === dataserverId)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setDataserverId("")
      setFiltro("")
    }
    onOpenChange(next)
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
              onValueChange={setDataserverId}
              placeholder="Selecione um Data Server"
              searchPlaceholder="Buscar Data Server..."
              emptyText="Nenhum Data Server cadastrado."
            />
          </Field>
          <Field>
            <FieldLabel>Filtro (ReadView, opcional)</FieldLabel>
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="ex.: CODCOLIGADA=1;CODPROCESSO=123"
            />
          </Field>
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
