"use client"

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DemandImportForm } from "@/components/shared/demand-import-form"
import type { Client, Analyst, Requester, Department, DemandType } from "@/generated/prisma/client"

interface Props {
  clients: Client[]
  analysts: Analyst[]
  requesters: Requester[]
  departments: Department[]
  demandTypes: DemandType[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Opened from the demands table's "Processos" menu. */
export function DemandImportDialog({ clients, analysts, requesters, departments, demandTypes, open, onOpenChange }: Props) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Demandas</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DemandImportForm
              clients={clients}
              analysts={analysts}
              requesters={requesters}
              departments={departments}
              demandTypes={demandTypes}
              onClose={() => onOpenChange(false)}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
