"use client"

import { useState } from "react"
import { FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DemandImportForm } from "@/components/shared/demand-import-form"
import type { Client, Analyst, Requester, Department, DemandType } from "@/generated/prisma/client"

interface Props {
  clients: Client[]
  analysts: Analyst[]
  requesters: Requester[]
  departments: Department[]
  demandTypes: DemandType[]
}

export function DemandImportDialog({ clients, analysts, requesters, departments, demandTypes }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4 mr-2" />
        Importar Demandas
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
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
              onClose={() => setOpen(false)}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
