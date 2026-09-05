"use client"

import { useEffect, useState } from "react"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Combobox } from "@/components/ui/combobox"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { TbcRow } from "@/services/tbc.service"

export type RestoreScope =
  | { type: "filter-latest"; filterId: string }
  | { type: "run"; backupRunId: string; filterId: string }
  | { type: "single"; backupId: string; filterId: string }

interface RestoreBackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: RestoreScope | null
  clientName: string
  tbcName: string
  filterValue: string
  ownTbcId: string
  onProceed: (targetTbcId: string) => void
}

export function RestoreBackupDialog({
  open,
  onOpenChange,
  scope,
  clientName,
  tbcName,
  filterValue,
  ownTbcId,
  onProceed,
}: RestoreBackupDialogProps) {
  const [target, setTarget] = useState<"own" | "other">("own")
  const [otherTbcId, setOtherTbcId] = useState("")
  const [tbcs, setTbcs] = useState<TbcRow[]>([])
  const [loadingTbcs, setLoadingTbcs] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  useEffect(() => {
    if (!open) return
    setLoadingTbcs(true)
    listAllTbcs()
      .then(setTbcs)
      .finally(() => setLoadingTbcs(false))
  }, [open])

  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setTarget("own")
      setOtherTbcId("")
    }
  }

  const otherTbcs = tbcs.filter((t) => t.id !== ownTbcId)

  function handleContinue() {
    const targetTbcId = target === "own" ? ownTbcId : otherTbcId
    if (!targetTbcId) return
    onProceed(targetTbcId)
  }

  return (
    <Dialog open={open && !!scope} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurar Backup</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Cliente:</span> {clientName}</p>
            <p><span className="text-muted-foreground">TBC:</span> {tbcName}</p>
            <p>
              <span className="text-muted-foreground">Filtro:</span>{" "}
              <span className="font-jetbrains font-bold">{filterValue}</span>
            </p>
          </div>

          <RadioGroup value={target} onValueChange={(v) => setTarget(v as "own" | "other")}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="own" id="target-own" />
              <Label htmlFor="target-own">Próprio TBC</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="other" id="target-other" />
              <Label htmlFor="target-other">Outro TBC</Label>
            </div>
          </RadioGroup>

          {target === "other" && (
            loadingTbcs ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Combobox
                items={otherTbcs.map((t) => ({ value: t.id, label: `${t.client?.name ?? ""} | ${t.name}` }))}
                value={otherTbcId}
                onValueChange={setOtherTbcId}
                placeholder="Selecione um TBC"
                searchPlaceholder="Buscar TBC..."
                emptyText="Nenhum TBC encontrado."
              />
            )
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={target === "other" && !otherTbcId}
            className="w-full sm:w-auto"
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
