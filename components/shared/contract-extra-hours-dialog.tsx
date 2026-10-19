"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ContractUsageBar } from "@/components/shared/contract-usage-bar"
import { addContractExtraHours, deleteContractExtraHours, listContractExtraHours } from "@/actions/contracts"
import { formatHours, periodKey, type UsageLevel } from "@/lib/contract-usage"
import { formatDecimal } from "@/lib/masks"

type ExtraHoursEntry = { id: string; hours: number; notes: string | null; createdAt: string | Date }

export type ExtraHoursTarget = {
  id: string
  contractedHours: number
  monthExtraHours: number
  client: { name: string }
  usage: {
    usedHours: number
    demandHours?: number
    projectHours?: number
    contractedHours: number
    percent: number
    level: UsageLevel
  } | null
}

interface ContractExtraHoursDialogProps {
  contract: ExtraHoursTarget | null
  month: { year: number; month: number }
  monthLabel: string
  onOpenChange: (open: boolean) => void
  /** Called after an entry is added/removed so the table refetches the month's consumption. */
  onChanged: () => void
}

/**
 * "Horas extras do mês": lists and launches extra hours for one contract in the month being viewed.
 * They add to that month's allowance only — the contract's own "Horas Contratadas" never changes.
 */
export function ContractExtraHoursDialog({
  contract,
  month,
  monthLabel,
  onOpenChange,
  onChanged,
}: ContractExtraHoursDialogProps) {
  const period = periodKey(month)
  return (
    <Dialog open={!!contract} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Horas extras — {monthLabel}</DialogTitle>
        </DialogHeader>
        {/* Keyed per contract/month so the list and form start fresh for each one. */}
        {contract && (
          <ExtraHoursPanel
            key={`${contract.id}:${period}`}
            contract={contract}
            period={period}
            monthLabel={monthLabel}
            onClose={() => onOpenChange(false)}
            onChanged={onChanged}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ExtraHoursPanel({
  contract,
  period,
  monthLabel,
  onClose,
  onChanged,
}: {
  contract: ExtraHoursTarget
  period: string
  monthLabel: string
  onClose: () => void
  onChanged: () => void
}) {
  const [entries, setEntries] = useState<ExtraHoursEntry[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [hours, setHours] = useState(0)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExtraHoursEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    listContractExtraHours(contract.id, period).then((result) => {
      if (cancelled) return
      setLoadingList(false)
      if (result.success) setEntries(result.data)
      else toast.error(result.error)
    })
    return () => {
      cancelled = true
    }
  }, [contract.id, period, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)
  const extraTotal = entries.reduce((sum, e) => sum + e.hours, 0)
  const baseHours = contract.contractedHours

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (hours <= 0) {
      setError("Horas devem ser maiores que zero")
      return
    }
    setSaving(true)
    const formData = new FormData()
    formData.append("contractId", contract.id)
    formData.append("period", period)
    formData.append("hours", String(hours))
    if (notes.trim()) formData.append("notes", notes.trim())
    const result = await addContractExtraHours(formData)
    setSaving(false)
    if (result.success) {
      toast.success(`+${formatHours(hours)} lançadas em ${monthLabel}`)
      setHours(0)
      setNotes("")
      setError(undefined)
      reload()
      onChanged()
    } else {
      toast.error(result.error || "Erro ao lançar horas extras")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteContractExtraHours(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (result.success) {
      toast.success("Lançamento removido")
      reload()
      onChanged()
    } else {
      toast.error(result.error || "Erro ao remover")
    }
  }

  return (
    <>
      <form onSubmit={handleAdd} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">{contract.client.name}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              Franquia {formatHours(baseHours)} + extras {formatHours(extraTotal)} ={" "}
              <span className="font-semibold text-foreground">{formatHours(baseHours + extraTotal)}</span> em{" "}
              {monthLabel}
            </p>
            {contract.usage && <ContractUsageBar {...contract.usage} />}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Lançamentos do mês</p>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma hora extra lançada neste mês.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">+{formatHours(entry.hours)}</p>
                      {entry.notes && <p className="text-xs text-muted-foreground break-words">{entry.notes}</p>}
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover lançamento"
                      onClick={() => setDeleteTarget(entry)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="extraHours">Horas adicionais</FieldLabel>
            <Input
              id="extraHours"
              inputMode="decimal"
              value={formatDecimal(String(Math.round(hours * 100)))}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "")
                setHours(digits ? Number(digits) / 100 : 0)
                setError(undefined)
              }}
              placeholder="0,00"
              aria-invalid={!!error}
            />
            <FieldDescription>
              Somam apenas às horas de {monthLabel}; as horas contratadas do contrato não mudam.
            </FieldDescription>
            <FieldError errors={error ? [{ message: error }] : []} />
          </Field>
          <Field>
            <FieldLabel htmlFor="extraNotes">Observações</FieldLabel>
            <Textarea
              id="extraNotes"
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: pacote adicional aprovado pelo cliente (opcional)"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Adicionar
          </Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
        title="Remover horas extras"
        description={
          deleteTarget ? `Remover o lançamento de +${formatHours(deleteTarget.hours)} de ${monthLabel}?` : ""
        }
        confirmLabel="Remover"
        variant="destructive"
        loading={deleting}
        loadingLabel="Removendo…"
        onConfirm={handleDelete}
      />
    </>
  )
}
