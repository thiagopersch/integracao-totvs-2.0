"use client"

import { useState } from "react"
import { FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DemandExportForm } from "@/components/shared/demand-export-form"
import type { Client } from "@/generated/prisma/client"

interface Props {
  clients: Client[]
  years: number[]
  monthsByYear: Record<number, number[]>
}

export function DemandExportDialog({ clients, years, monthsByYear }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4 mr-2" />
        Exportar Demandas
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
