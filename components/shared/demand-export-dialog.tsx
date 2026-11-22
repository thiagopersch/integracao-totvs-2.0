"use client"

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DemandExportForm } from "@/components/shared/demand-export-form"
import type { Client } from "@/generated/prisma/client"

interface Props {
  clients: Client[]
  years: number[]
  monthsByYear: Record<number, number[]>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Opened from the demands table's "Processos" menu. */
export function DemandExportDialog({ clients, years, monthsByYear, open, onOpenChange }: Props) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Exportar Demandas</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DemandExportForm clients={clients} years={years} monthsByYear={monthsByYear} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
