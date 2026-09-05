"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { DateCell } from "@/components/shared/date-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { TimePicker } from "@/components/ui/time-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, RotateCcw, History, Loader2, Download } from "lucide-react"
import { RestoreBackupDialog, type RestoreScope } from "@/components/shared/restore-backup-dialog"
import { RestorePasswordConfirmDialog } from "@/components/shared/restore-password-confirm-dialog"
import { deleteFilter, restoreFilter, createFilter, updateFilter, createBackupFromFilter, bulkDeleteFilters, setFilterStatus, importStandardSentencesToTbc } from "@/actions/admin/filters"
import { BACKUP_SCHEDULE_LABELS, SCHEDULES_WITH_TIME_OF_DAY } from "@/lib/backup-schedule"
import { createFilterSchema, updateFilterSchema, type CreateFilterInput } from "@/schemas/filter.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { Filter, TotvsSystem, SentenceCategory } from "@/generated/prisma/client"
import type { Client } from "@/generated/prisma/client"
import type { TbcRow } from "@/services/tbc.service"
import type { PaginationMeta } from "@/types/common"

const DEFAULT_FILTER_VALUE = "CODSENTENCA LIKE 'RB%'"

const BACKUP_STATUS_LABELS: Record<string, string> = {
  RUNNING: "Em andamento",
  ERROR: "Erro",
  DONE: "Concluído",
}

interface FilterRow extends Filter {
  tbc: { id: string; name: string } | null
  client: { id: string; name: string } | null
  lastBackupBy: { id: string; name: string } | null
  scheduleCategory: { id: string; name: string } | null
}

interface FilterTableProps {
  data: FilterRow[]
  meta: PaginationMeta
  clients: Client[]
  tbcs: TbcRow[]
  sistemas: TotvsSystem[]
  categories: SentenceCategory[]
  filterClients: Client[]
  sentenceCodes: { codigosColigada: string[]; codigosSistema: string[] }
}

const SORTABLE_COLUMNS = ["status", "filter"]

export function FilterTable({ data, meta, clients, tbcs, sistemas, categories, filterClients, sentenceCodes }: FilterTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    handleToggleStatus,
    sort,
    onSortChange,
  } = useCrudTable<FilterRow>({
    deleteAction: deleteFilter,
    restoreAction: restoreFilter,
    setStatusAction: setFilterStatus,
    deleteSuccessMessage: "Filtro excluído com sucesso",
    restoreSuccessMessage: "Filtro restaurado com sucesso",
  })
  const canCreate = useHasPermission("filters", "create")
  const canUpdate = useHasPermission("filters", "update")
  const canDelete = useHasPermission("filters", "delete")
  const canViewBackups = useHasPermission("backups", "read")
  const canRunBackup = useHasPermission("backups", "create")
  const canRestoreBackup = useHasPermission("backups", "restore")
  const [loading, setLoading] = useState(false)
  const [clientFilter, setClientFilter] = useState(searchParams.get("clientId") || "")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const [noLicenseFilter, setNoLicenseFilter] = useState(searchParams.get("notRequiredLicense") || "")
  const [coligadaSentencaFilter, setColigadaSentencaFilter] = useState(searchParams.get("codColigadaSentenca") || "")
  const [sistemaSentencaFilter, setSistemaSentencaFilter] = useState(searchParams.get("codSistemaSentenca") || "")
  const [backupDialog, setBackupDialog] = useState<{ open: boolean; filterId?: string }>({ open: false })
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean
    scope: RestoreScope | null
    clientName: string
    tbcName: string
    filterValue: string
    ownTbcId: string
  }>({ open: false, scope: null, clientName: "", tbcName: "", filterValue: "", ownTbcId: "" })
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean
    scope: RestoreScope | null
    targetTbcId: string | null
  }>({ open: false, scope: null, targetTbcId: null })
  const [backupCategoryId, setBackupCategoryId] = useState("")
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importTbcId, setImportTbcId] = useState("")
  const [importCategoryId, setImportCategoryId] = useState("")
  const [importing, setImporting] = useState(false)

  async function handleImportStandardSentences() {
    if (!importTbcId || !importCategoryId) {
      toast.error("Selecione o TBC e a categoria")
      return
    }
    setImporting(true)
    try {
      const result = await importStandardSentencesToTbc(importTbcId, importCategoryId)
      if (!result.success) {
        toast.error(result.error || "Erro ao importar sentenças padrões")
        return
      }
      if (result.imported) toast.success(`${result.imported} sentença(s) importada(s) para o RM`)
      if (result.failed && result.failed.length > 0) {
        toast.error(`${result.failed.length} sentença(s) não puderam ser importadas`, {
          description: result.failed.map((f) => `${f.code}: ${f.error}`).join("\n"),
          duration: 10000,
        })
      }
      setImportDialogOpen(false)
      setImportTbcId("")
      setImportCategoryId("")
    } finally {
      setImporting(false)
    }
  }

  const form = useForm<CreateFilterInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateFilterSchema : createFilterSchema) as Resolver<CreateFilterInput>,
    values: editDialog.entity
      ? {
          clientId: editDialog.entity.clientId,
          tbcId: editDialog.entity.tbcId,
          filter: editDialog.entity.filter,
          coligateContext: editDialog.entity.coligateContext,
          branchContext: editDialog.entity.branchContext,
          levelEducationContext: editDialog.entity.levelEducationContext,
          codSystemContext: editDialog.entity.codSystemContext,
          userContext: editDialog.entity.userContext,
          codColigadaSentenca: editDialog.entity.codColigadaSentenca || "",
          codSistemaSentenca: editDialog.entity.codSistemaSentenca || "",
          status: editDialog.entity.status,
          schedule: editDialog.entity.schedule,
          scheduleTime: editDialog.entity.scheduleTime || "",
          scheduleCategoryId: editDialog.entity.scheduleCategoryId || "",
        } as CreateFilterInput
      : {
          clientId: "",
          tbcId: "",
          filter: DEFAULT_FILTER_VALUE,
          coligateContext: 1,
          branchContext: 1,
          levelEducationContext: 1,
          codSystemContext: "S",
          userContext: "",
          codColigadaSentenca: "",
          codSistemaSentenca: "",
          status: true,
          schedule: "NONE",
          scheduleTime: "",
          scheduleCategoryId: "",
        },
  })

  const selectedClientId = form.watch("clientId")
  const availableTbcs = tbcs.filter((t) => t.clientId === selectedClientId)
  const selectedSchedule = form.watch("schedule")

  async function onSubmit(data: CreateFilterInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateFilter(editDialog.entity.id, formData)
      : await createFilter(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Filtro atualizado" : "Filtro criado")
      form.reset()
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setEditDialog({ open: false })
  }

  async function handleBackup(filterId: string, sentenceCategoryId?: string) {
    const result = await createBackupFromFilter(filterId, sentenceCategoryId)
    if (result.success) {
      toast.success("Backup realizado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao realizar backup")
    }
    setBackupDialog({ open: false })
    setBackupCategoryId("")
  }

  const columns: ColumnDef<FilterRow>[] = [
    createSelectColumn<FilterRow>(),
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as boolean
        return <Badge variant={status ? "success" : "destructive"}>{status ? "Ativo" : "Inativo"}</Badge>
      },
    },
    {
      id: "clientName",
      header: "Nome do Cliente",
      cell: ({ row }) => row.original.client?.name || "-",
    },
    {
      id: "tbcName",
      header: "Nome do TBC",
      cell: ({ row }) => row.original.tbc?.name || "-",
    },
    {
      accessorKey: "filter",
      header: "Filtro",
      cell: ({ row }) => <span className="font-jetbrains font-bold">{row.getValue("filter")}</span>,
    },
    {
      accessorKey: "schedule",
      header: "Agendamento",
      cell: ({ row }) => {
        const schedule = row.getValue("schedule") as keyof typeof BACKUP_SCHEDULE_LABELS
        if (schedule === "NONE") {
          return <span className="text-muted-foreground text-sm">{BACKUP_SCHEDULE_LABELS.NONE}</span>
        }
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="outline">
              {BACKUP_SCHEDULE_LABELS[schedule]}
              {row.original.scheduleTime ? ` às ${row.original.scheduleTime}` : ""}
            </Badge>
            {row.original.scheduleCategory && (
              <span className="text-muted-foreground text-xs">{row.original.scheduleCategory.name}</span>
            )}
          </div>
        )
      },
    },
    {
      id: "coligadaSistemaSentenca",
      header: "Coligada;Sistema",
      cell: ({ row }) => (
        <span className="font-jetbrains">
          [{row.original.codColigadaSentenca};{row.original.codSistemaSentenca}]
        </span>
      ),
    },
    {
      id: "backupStatus",
      header: "Status do Backup",
      cell: ({ row }) => {
        const status = row.original.lastBackupStatus
        if (!status) return <Badge variant="outline">Nunca executado</Badge>
        const variant = status === "DONE" ? "success" : status === "ERROR" ? "destructive" : "secondary"
        return <Badge variant={variant}>{BACKUP_STATUS_LABELS[status] || status}</Badge>
      },
    },
    {
      id: "lastUpdate",
      header: "Última Atualização",
      cell: ({ row }) => {
        const at = row.original.lastBackupAt
        if (!at) return "-"
        return (
          <div className="flex flex-col text-xs">
            <DateCell date={at}>{new Date(at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</DateCell>
            {row.original.lastBackupBy && (
              <span className="text-muted-foreground">{row.original.lastBackupBy.name}</span>
            )}
          </div>
        )
      },
    },
  ]

  const actionsColumn: ColumnDef<FilterRow> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
        onToggleStatus={canUpdate ? () => handleToggleStatus(row.original.id, row.original.status) : undefined}
        isActive={row.original.status}
        beforeEdit={
          <>
            {canViewBackups && (
              <DropdownMenuItem onClick={() => router.push(`/admin/backups/${row.original.id}`)}>
                <History className="h-4 w-4 mr-2" /> Backups
              </DropdownMenuItem>
            )}
            {canRunBackup && (
              <DropdownMenuItem onClick={() => setBackupDialog({ open: true, filterId: row.original.id })}>
                <RotateCcw className="h-4 w-4 mr-2" /> Realizar Backup
              </DropdownMenuItem>
            )}
            {canRestoreBackup && (
              <DropdownMenuItem
                onClick={() =>
                  setRestoreDialog({
                    open: true,
                    scope: { type: "filter-latest", filterId: row.original.id },
                    clientName: row.original.client?.name || "",
                    tbcName: row.original.tbc?.name || "",
                    filterValue: row.original.filter,
                    ownTbcId: row.original.tbcId,
                  })
                }
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Restaurar Backup
              </DropdownMenuItem>
            )}
          </>
        }
      />
    ),
  }
  if (canUpdate || canDelete || canViewBackups || canRunBackup || canRestoreBackup) columns.push(actionsColumn)

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Filtro</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Filtro" : "Novo Filtro"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Checkbox
                  id="status"
                  checked={field.value ?? true}
                  onCheckedChange={(value) => field.onChange(!!value)}
                />
              )}
            />
            <Label htmlFor="status">Filtro ativo</Label>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
              <Combobox
                items={clients.map((client) => ({ value: client.id, label: client.name }))}
                value={form.watch("clientId")}
                onValueChange={(v) => {
                  form.setValue("clientId", v, { shouldValidate: true })
                  const currentTbcId = form.getValues("tbcId")
                  const stillValid = tbcs.find((t) => t.id === currentTbcId && t.clientId === v)
                  if (!stillValid) form.setValue("tbcId", "")
                }}
                placeholder="Selecione um cliente"
                searchPlaceholder="Buscar cliente..."
                emptyText="Nenhum cliente encontrado."
                aria-invalid={!!form.formState.errors.clientId}
              />
              <FieldError errors={[form.formState.errors.clientId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="tbcId">TBC</FieldLabel>
              <Combobox
                items={availableTbcs.map((tbc) => ({ value: tbc.id, label: `${tbc.client?.name ?? ""} | ${tbc.link} | ${tbc.user}` }))}
                value={form.watch("tbcId")}
                onValueChange={(v) => form.setValue("tbcId", v, { shouldValidate: true })}
                disabled={!selectedClientId}
                placeholder={selectedClientId ? "Selecione um TBC" : "Selecione um cliente primeiro"}
                searchPlaceholder="Buscar TBC..."
                emptyText="Nenhum TBC encontrado."
                aria-invalid={!!form.formState.errors.tbcId}
              />
              <FieldError errors={[form.formState.errors.tbcId]} />
              {selectedClientId && availableTbcs.length === 0 && (
                <p className="text-sm text-muted-foreground">Este cliente não possui um TBC cadastrado.</p>
              )}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="filter">Filtro</FieldLabel>
            <Input id="filter" className="w-full font-jetbrains" {...form.register("filter")} placeholder="Nome do filtro" aria-invalid={!!form.formState.errors.filter} />
            <FieldError errors={[form.formState.errors.filter]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="codColigadaSentenca">Cód. Coligada Sentença</FieldLabel>
              <Input
                id="codColigadaSentenca"
                className="w-full"
                maxLength={5}
                inputMode="numeric"
                {...form.register("codColigadaSentenca")}
                placeholder="00001"
                aria-invalid={!!form.formState.errors.codColigadaSentenca}
              />
              <FieldError errors={[form.formState.errors.codColigadaSentenca]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="codSistemaSentenca">Cód. Sistema Sentença</FieldLabel>
              <Select
                items={sistemas.map((s) => ({ value: s.code, label: `${s.code} - ${s.internalName} (${s.externalName})` }))}
                value={form.watch("codSistemaSentenca") || null}
                onValueChange={(v) => form.setValue("codSistemaSentenca", v || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um sistema" />
                </SelectTrigger>
                <SelectContent>
                  {sistemas.map((s) => (
                    <SelectItem key={s.id} value={s.code}>{s.code} - {s.internalName} ({s.externalName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="schedule">Agendamento</FieldLabel>
              <Select
                items={Object.entries(BACKUP_SCHEDULE_LABELS).map(([value, label]) => ({ value, label }))}
                value={selectedSchedule || "NONE"}
                onValueChange={(v) => {
                  const next = (v || "NONE") as CreateFilterInput["schedule"]
                  form.setValue("schedule", next, { shouldValidate: true })
                  if (next === "NONE") {
                    form.setValue("scheduleTime", "")
                    form.setValue("scheduleCategoryId", "")
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BACKUP_SCHEDULE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {selectedSchedule !== "NONE" && (
              <Field>
                <FieldLabel htmlFor="scheduleCategoryId">Categoria</FieldLabel>
                <Select
                  items={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={form.watch("scheduleCategoryId") || null}
                  onValueChange={(v) => form.setValue("scheduleCategoryId", v || "", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.scheduleCategoryId}>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[form.formState.errors.scheduleCategoryId]} />
              </Field>
            )}
            {selectedSchedule !== "NONE" && SCHEDULES_WITH_TIME_OF_DAY.has(selectedSchedule) && (
              <Field>
                <FieldLabel htmlFor="scheduleTime">Horário da execução</FieldLabel>
                <TimePicker
                  id="scheduleTime"
                  className="w-full"
                  value={form.watch("scheduleTime") || ""}
                  onValueChange={(v) => form.setValue("scheduleTime", v, { shouldValidate: true })}
                  aria-invalid={!!form.formState.errors.scheduleTime}
                />
                <FieldError errors={[form.formState.errors.scheduleTime]} />
              </Field>
            )}
          </div>

          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Contexto</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <Field>
                <FieldLabel htmlFor="coligateContext">Código da coligada</FieldLabel>
                <Input id="coligateContext" className="w-full" type="number" {...form.register("coligateContext", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel htmlFor="branchContext">Código da Filial</FieldLabel>
                <Input id="branchContext" className="w-full" type="number" {...form.register("branchContext", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel htmlFor="levelEducationContext">Nível de ensino</FieldLabel>
                <Input id="levelEducationContext" className="w-full" type="number" {...form.register("levelEducationContext", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel htmlFor="codSystemContext">Código do sistema</FieldLabel>
                <Input id="codSystemContext" className="w-full" {...form.register("codSystemContext")} placeholder="Código do sistema" aria-invalid={!!form.formState.errors.codSystemContext} />
                <FieldError errors={[form.formState.errors.codSystemContext]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="userContext">Código do usuário</FieldLabel>
                <Input id="userContext" className="w-full" {...form.register("userContext")} placeholder="Usuário de contexto" aria-invalid={!!form.formState.errors.userContext} />
                <FieldError errors={[form.formState.errors.userContext]} />
              </Field>
            </div>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading} className="w-full sm:w-auto">Cancelar</Button>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const importDialog = (
    <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) { setImportTbcId(""); setImportCategoryId("") } }}>
      <DialogTrigger render={<Button variant="outline"><Download className="h-4 w-4 mr-2" /> Importar sentenças padrões</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar sentenças padrões</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            Todas as sentenças padrões ativas da categoria selecionada serão gravadas no TOTVS RM através do TBC escolhido, usando o código do sistema e o código da sentença de cada uma.
          </p>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              items={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={importCategoryId || null}
              onValueChange={(v) => setImportCategoryId(v || "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>TBC de destino</Label>
            <Combobox
              items={tbcs.map((t) => ({ value: t.id, label: `${t.client?.name ?? ""} | ${t.name}` }))}
              value={importTbcId}
              onValueChange={setImportTbcId}
              placeholder="Selecione um TBC"
              searchPlaceholder="Buscar TBC..."
              emptyText="Nenhum TBC encontrado."
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>Cancelar</Button>
          <Button type="button" onClick={handleImportStandardSentences} disabled={importing}>
            {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() =>
        pushParams({
          clientId: clientFilter || undefined,
          status: statusFilter || undefined,
          notRequiredLicense: noLicenseFilter || undefined,
          codColigadaSentenca: coligadaSentencaFilter || undefined,
          codSistemaSentenca: sistemaSentencaFilter || undefined,
          page: 1,
        })
      }
      onClear={() => {
        setClientFilter("")
        setStatusFilter("")
        setNoLicenseFilter("")
        setColigadaSentencaFilter("")
        setSistemaSentencaFilter("")
        pushParams({
          clientId: undefined,
          status: undefined,
          notRequiredLicense: undefined,
          codColigadaSentenca: undefined,
          codSistemaSentenca: undefined,
          page: 1,
        })
      }}
    >
      <div className="space-y-2">
        <Label>Clientes</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...filterClients.map((c) => ({ value: c.id, label: c.name }))]}
          value={clientFilter || "all"}
          onValueChange={(v) => setClientFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterClients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Ativo</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Utiliza métodos sem licenças</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={noLicenseFilter || "all"}
          onValueChange={(v) => setNoLicenseFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Código da coligada Sentença</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...sentenceCodes.codigosColigada.map((c) => ({ value: c, label: c }))]}
          value={coligadaSentencaFilter || "all"}
          onValueChange={(v) => setColigadaSentencaFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {sentenceCodes.codigosColigada.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Código do sistema Sentença</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...sentenceCodes.codigosSistema.map((c) => ({ value: c, label: c }))]}
          value={sistemaSentencaFilter || "all"}
          onValueChange={(v) => setSistemaSentencaFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {sentenceCodes.codigosSistema.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Filtros" description="Gerenciar filtros" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por filtro, código ou usuário..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={
          <div className="flex items-center gap-2">
            {canCreate && importDialog}
            {canCreate && newDialog}
          </div>
        }
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.filter,
          action: bulkDeleteFilters,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Filtro"
        description="Tem certeza que deseja excluir este filtro? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />

      <ConfirmDialog
        open={backupDialog.open}
        onOpenChange={(open) => { setBackupDialog({ open, filterId: backupDialog.filterId }); if (!open) setBackupCategoryId("") }}
        title="Realizar Backup"
        description="Selecione a categoria que será vinculada às sentenças deste backup."
        confirmLabel="Realizar Backup"
        onConfirm={() => backupDialog.filterId && handleBackup(backupDialog.filterId, backupCategoryId || undefined)}
      >
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select
            items={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={backupCategoryId || null}
            onValueChange={(v) => setBackupCategoryId(v || "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>

      <RestoreBackupDialog
        open={restoreDialog.open}
        onOpenChange={(open) => setRestoreDialog((prev) => ({ ...prev, open, scope: open ? prev.scope : null }))}
        scope={restoreDialog.scope}
        clientName={restoreDialog.clientName}
        tbcName={restoreDialog.tbcName}
        filterValue={restoreDialog.filterValue}
        ownTbcId={restoreDialog.ownTbcId}
        onProceed={(targetTbcId) => {
          setPasswordDialog({ open: true, scope: restoreDialog.scope, targetTbcId })
          setRestoreDialog((prev) => ({ ...prev, open: false, scope: null }))
        }}
      />
      <RestorePasswordConfirmDialog
        open={passwordDialog.open}
        onOpenChange={(open) =>
          setPasswordDialog({ open, scope: open ? passwordDialog.scope : null, targetTbcId: open ? passwordDialog.targetTbcId : null })
        }
        scope={passwordDialog.scope}
        targetTbcId={passwordDialog.targetTbcId}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
