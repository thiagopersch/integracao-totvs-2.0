"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  verifyPasswordForRestore,
  restoreLatestBackupsForFilter,
  restoreBackupsForRun,
  restoreSingleBackup,
} from "@/actions/admin/backups"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { RestoreScope } from "@/components/shared/restore-backup-dialog"

interface RestorePasswordConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: RestoreScope | null
  targetTbcId: string | null
  onSuccess: () => void
}

export function RestorePasswordConfirmDialog({
  open,
  onOpenChange,
  scope,
  targetTbcId,
  onSuccess,
}: RestorePasswordConfirmDialogProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  function reset() {
    setPassword("")
    setError(undefined)
  }

  async function handleConfirm() {
    if (!scope || !targetTbcId) return
    setLoading(true)
    setError(undefined)

    const verified = await verifyPasswordForRestore(password)
    if (!verified.success) {
      setError(verified.error || "Senha incorreta")
      setLoading(false)
      return
    }

    const result =
      scope.type === "filter-latest"
        ? await restoreLatestBackupsForFilter(scope.filterId, targetTbcId)
        : scope.type === "run"
          ? await restoreBackupsForRun(scope.backupRunId, targetTbcId)
          : await restoreSingleBackup(scope.backupId, targetTbcId)

    setLoading(false)
    if (result.success) {
      const restored = result.restored ?? 0
      const failedCount = result.failed?.length ?? 0
      if (failedCount === 0) {
        toast.success(`${restored} consulta(s) restaurada(s) com sucesso`)
      } else {
        toast.warning(
          `${restored} consulta(s) restaurada(s), ${failedCount} com erro. Veja os detalhes em Rastreamento de Atividades.`
        )
      }
      reset()
      onOpenChange(false)
      onSuccess()
    } else {
      toast.error(result.error || "Erro ao restaurar backup")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Restauração</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            Esta ação irá restaurar as sentenças do filtro selecionado no TOTVS RM. Digite sua senha para confirmar.
          </p>
          <div className="space-y-2">
            <Label htmlFor="restore-password">Senha</Label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              showStrength={false}
              aria-invalid={!!error}
              placeholder="Sua senha atual"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading || !password} className="w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar Restauração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
