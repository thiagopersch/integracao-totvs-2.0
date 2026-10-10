"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { PeriodSelect } from "@/components/shared/period-select"
import { usePeriodFilter } from "@/hooks/use-period-filter"
import type { Period } from "@/lib/period"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { DateCell } from "@/components/shared/date-cell"
import { ColorBadge } from "@/components/shared/color-badge"
import { ContractUsageBar } from "@/components/shared/contract-usage-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { Plus, Loader2, TriangleAlert, Send } from "lucide-react"
import {
  deleteContract,
  createContract,
  updateContract,
  bulkDeleteContracts,
  resendContractUsageNotification,
} from "@/actions/contracts"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { createContractSchema, updateContractSchema, type CreateContractInput } from "@/schemas/contract.schema"
import { formatDecimal } from "@/lib/masks"
import type { UsageLevel } from "@/lib/contract-usage"
import { formatDateOnly, toDateInputValue } from "@/utils/format"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { Client } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

type ContractRow = {
  id: string
  contractedHours: number
  startDate: string | Date
  endDate: string | Date | null
  status: string
  notifyClient: boolean
  notes: string | null
  client: { id: string; name: string; color: string; email: string | null }
  /** Consumption (per client) of the month being viewed — null when the contract isn't in force that month. */
  usage: { usedHours: number; contractedHours: number; percent: number; level: UsageLevel } | null
}

interface ContractTableProps {
  data: ContractRow[]
  meta: PaginationMeta
  clients: Client[]
  /** Month the "Consumo" column refers to (selected period's month, or the current month). */
  usageMonth: { year: number; month: number }
  usageMonthLabel: string
  period: Period | null
  years: number[]
  monthsByYear: Record<number, number[]>
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#22c55e",
  SUSPENDED: "#f97316",
  EXPIRED: "#6b7280",
  CANCELLED: "#ef4444",
}

const SORTABLE_COLUMNS = ["contractedHours", "usagePercent", "startDate", "endDate", "status"]

export function ContractTable({
  data,
  meta,
  clients,
  usageMonth,
  usageMonthLabel,
  period: initialPeriod,
  years,
  monthsByYear,
}: ContractTableProps) {
  const {
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    sort,
    onSortChange,
    refresh,
    isPending,
  } = useCrudTable<ContractRow>({
    deleteAction: deleteContract,
    deleteSuccessMessage: "Contrato excluído com sucesso",
    defaultSort: { field: "contractedHours", direction: "desc" },
  })
  const canCreate = useHasPermission("contracts", "create")
  const canUpdate = useHasPermission("contracts", "update")
  const canDelete = useHasPermission("contracts", "delete")
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const [resendTarget, setResendTarget] = useState<ContractRow | null>(null)
  const [resending, setResending] = useState(false)
  const { period, setPeriod, isPending: isPeriodPending } = usePeriodFilter(initialPeriod)

  async function handleResend() {
    if (!resendTarget) return
    setResending(true)
    const result = await resendContractUsageNotification(resendTarget.id, usageMonth)
    setResending(false)
    setResendTarget(null)
    if (result.success) toast.success(result.message)
    else toast.error(result.error)
  }

  const form = useForm<CreateContractInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateContractSchema : createContractSchema) as Resolver<CreateContractInput>,
    values: editDialog.entity
      ? {
          clientId: editDialog.entity.client.id,
          contractedHours: editDialog.entity.contractedHours,
          startDate: toDateInputValue(editDialog.entity.startDate),
          endDate: editDialog.entity.endDate ? toDateInputValue(editDialog.entity.endDate) : "",
          status: editDialog.entity.status as CreateContractInput["status"],
          notifyClient: editDialog.entity.notifyClient,
          notes: editDialog.entity.notes || "",
        }
      : {
          clientId: "",
          contractedHours: 40,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          status: "ACTIVE",
          notifyClient: false,
          notes: "",
        },
  })

  const selectedClient = clients.find((c) => c.id === form.watch("clientId"))

  async function onSubmit(data: CreateContractInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateContract(editDialog.entity.id, formData)
      : await createContract(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Contrato atualizado" : "Contrato criado")
      form.reset()
      setEditDialog({ open: false })
      refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setEditDialog({ open: false })
  }

  const columns: ColumnDef<ContractRow>[] = useMemo(() => {
    const columns: ColumnDef<ContractRow>[] = [
    createSelectColumn<ContractRow>(),
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return <ColorBadge label={STATUS_LABELS[status] || status} color={STATUS_COLORS[status] || "#6b7280"} />
      },
    },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => (
        <ColorBadge label={row.original.client.name} color={row.original.client.color} solid />
      ),
    },
    {
      accessorKey: "contractedHours",
      header: "Horas Contratadas",
      cell: ({ row }) => (row.getValue("contractedHours") as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      id: "usagePercent",
      header: `Consumo — ${usageMonthLabel}`,
      cell: ({ row }) => {
        const usage = row.original.usage
        if (!usage) return <span className="text-muted-foreground">-</span>
        return <ContractUsageBar {...usage} />
      },
    },
    {
      accessorKey: "startDate",
      header: "Início",
      cell: ({ row }) => {
        const startDate = row.getValue("startDate") as string
        return <DateCell date={startDate} timeZone="UTC">{formatDateOnly(startDate)}</DateCell>
      },
    },
    {
      accessorKey: "endDate",
      header: "Término",
      cell: ({ row }) => {
        const endDate = row.getValue("endDate") as string | Date | null
        if (!endDate) return "-"
        return <DateCell date={endDate} timeZone="UTC">{formatDateOnly(endDate)}</DateCell>
      },
    },
  ]

  const actionsColumn: ColumnDef<ContractRow> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
        extraItems={
          canUpdate ? (
            <DropdownMenuItem onClick={() => setResendTarget(row.original)}>
              <Send className="mr-2 h-4 w-4" /> Reenviar notificação de consumo
            </DropdownMenuItem>
          ) : undefined
        }
      />
    ),
  }
    if (canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canUpdate, canDelete, setEditDialog, setDeleteDialog, setResendTarget, usageMonthLabel])

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Contrato</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
            <Select
              items={clients.map((c) => ({ value: c.id, label: c.name }))}
              value={form.watch("clientId") || null}
              onValueChange={(v) => form.setValue("clientId", v || "", { shouldValidate: true })}
            >
              <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.clientId}>
                <SelectValue placeholder="Selecione um cliente">
                  {(value: string) => {
                    const client = clients.find((c) => c.id === value)
                    return client ? <ColorBadge label={client.name} color={client.color} solid /> : "Selecione um cliente"
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <ColorBadge label={c.name} color={c.color} solid />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[form.formState.errors.clientId]} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contractedHours">Horas Contratadas</FieldLabel>
              <Controller
                control={form.control}
                name="contractedHours"
                render={({ field }) => (
                  <Input
                    id="contractedHours"
                    inputMode="decimal"
                    value={formatDecimal(String(Math.round((field.value || 0) * 100)))}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "")
                      field.onChange(digits ? Number(digits) / 100 : 0)
                    }}
                    placeholder="0,00"
                    aria-invalid={!!form.formState.errors.contractedHours}
                  />
                )}
              />
              <FieldError errors={[form.formState.errors.contractedHours]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select
                items={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                value={form.watch("status") || "ACTIVE"}
                onValueChange={(v) => form.setValue("status", v as CreateContractInput["status"] || "ACTIVE")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value ? <ColorBadge label={STATUS_LABELS[value]} color={STATUS_COLORS[value]} /> : "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <ColorBadge label={label} color={STATUS_COLORS[value]} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="startDate">Início</FieldLabel>
              <DatePicker
                id="startDate"
                value={form.watch("startDate") || ""}
                onValueChange={(v) => form.setValue("startDate", v, { shouldValidate: true })}
                aria-invalid={!!form.formState.errors.startDate}
              />
              <FieldError errors={[form.formState.errors.startDate]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="endDate">Término (opcional)</FieldLabel>
              <DatePicker
                id="endDate"
                value={form.watch("endDate") || ""}
                onValueChange={(v) => {
                  form.setValue("endDate", v)
                  // Sem data de término não há como estar expirado: volta para ativo.
                  if (!v && form.getValues("status") === "EXPIRED") form.setValue("status", "ACTIVE")
                }}
                aria-invalid={!!form.formState.errors.endDate}
              />
              <FieldError errors={[form.formState.errors.endDate]} />
            </Field>
          </div>
          <Field orientation="horizontal">
            <Switch
              id="notifyClient"
              checked={!!form.watch("notifyClient")}
              onCheckedChange={(checked) => form.setValue("notifyClient", checked)}
            />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="notifyClient">Notificar cliente por e-mail</FieldLabel>
              <FieldDescription>
                Envia ao cliente os alertas de consumo (80%, 85%, 90%, 95% e 100% das horas do mês), com o e-mail de alertas em cópia.
              </FieldDescription>
              {form.watch("notifyClient") && selectedClient && !selectedClient.email && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  Este cliente não tem e-mail cadastrado — o alerta irá apenas para o e-mail de alertas.
                </p>
              )}
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="notes">Observações</FieldLabel>
            <Textarea id="notes" {...form.register("notes")} placeholder="Observações (opcional)" aria-invalid={!!form.formState.errors.notes} />
            <FieldError errors={[form.formState.errors.notes]} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ status: statusFilter || undefined, page: 1 })}
      onClear={() => {
        setStatusFilter("")
        pushParams({ status: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos">
              {(value: string) =>
                value && value !== "all" ? (
                  <ColorBadge label={STATUS_LABELS[value]} color={STATUS_COLORS[value]} />
                ) : (
                  "Todos"
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <ColorBadge label={label} color={STATUS_COLORS[value]} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Contratos" description="Gerenciar contratos de clientes">
        <PeriodSelect years={years} monthsByYear={monthsByYear} value={period} onChange={setPeriod} />
      </PageHeader>

      <DataTable
        refreshing={isPending || isPeriodPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por cliente..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={canCreate ? newDialog : undefined}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={
          canDelete
            ? {
                getId: (row) => row.id,
                getRowLabel: (row) => row.client.name,
                action: bulkDeleteContracts,
                confirmDescription: (count) => `Tem certeza que deseja excluir ${count} contrato(s) selecionado(s)? Esta ação não pode ser desfeita.`,
                onSuccess: () => refresh(),
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Contrato"
        description="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />

      <ConfirmDialog
        open={!!resendTarget}
        onOpenChange={(open) => !open && !resending && setResendTarget(null)}
        title="Reenviar notificação de consumo"
        description={
          resendTarget
            ? `Enviar agora o e-mail de consumo de horas de ${usageMonthLabel} de ${resendTarget.client.name}${
                resendTarget.notifyClient && resendTarget.client.email
                  ? ` para ${resendTarget.client.email} (com o e-mail de alertas em cópia, quando configurado)`
                  : " para o e-mail de alertas de contrato"
              }?`
            : ""
        }
        confirmLabel="Reenviar"
        loading={resending}
        loadingLabel="Enviando…"
        onConfirm={handleResend}
      >
        {resendTarget?.usage ? (
          <ContractUsageBar {...resendTarget.usage} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Sem consumo registrado neste mês.</p>
        )}
      </ConfirmDialog>
    </>
  )
}
