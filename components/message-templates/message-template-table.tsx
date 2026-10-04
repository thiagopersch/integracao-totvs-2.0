"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Copy, Plus, Send } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { ColorBadge } from "@/components/shared/color-badge"
import { DateCell } from "@/components/shared/date-cell"
import { buttonVariants } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  bulkDeleteMessageTemplates,
  deleteMessageTemplate,
  duplicateMessageTemplate,
  sendTestMessageTemplate,
  setMessageTemplateActive,
} from "@/actions/message-templates"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import { formatDate } from "@/utils/format"
import {
  MESSAGE_CHANNEL_COLORS,
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_EVENT_LABELS,
  type MessageChannel,
  type MessageTemplateEvent,
} from "@/lib/message-templates/events"
import type { PaginationMeta } from "@/types/common"

type MessageTemplateRow = {
  id: string
  name: string
  channel: MessageChannel
  event: MessageTemplateEvent
  subject: string
  isActive: boolean
  updatedAt: Date | string
}

const BASE_HREF = "/integrations/message-templates"
const SORTABLE_COLUMNS = ["name", "channel", "event", "isActive", "updatedAt"]
const ALL = "all"

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const items = [{ value: ALL, label: "Todos" }, ...options]
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select items={items} value={value || ALL} onValueChange={(v) => onChange(!v || v === ALL ? "" : v)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function MessageTemplateTable({ data, meta }: { data: MessageTemplateRow[]; meta: PaginationMeta }) {
  const { router, searchParams, deleteDialog, setDeleteDialog, pushParams, handleDelete, handleToggleStatus, sort, onSortChange, refresh, isPending } =
    useCrudTable<MessageTemplateRow>({
      deleteAction: deleteMessageTemplate,
      setStatusAction: setMessageTemplateActive,
      deleteSuccessMessage: "Template excluído com sucesso",
      defaultSort: { field: "updatedAt", direction: "desc" },
    })
  const canCreate = useHasPermission("message_templates", "create")
  const canUpdate = useHasPermission("message_templates", "update")
  const canDelete = useHasPermission("message_templates", "delete")
  const [channel, setChannel] = useState(searchParams.get("channel") || "")
  const [event, setEvent] = useState(searchParams.get("event") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "")

  const columns = useMemo<ColumnDef<MessageTemplateRow>[]>(() => {
    async function duplicate(id: string) {
      const result = await duplicateMessageTemplate(id)
      if (result.success) {
        toast.success("Template duplicado (inativo) — abrindo a cópia")
        router.push(`${BASE_HREF}/${result.id}`)
      } else toast.error(result.error)
    }
    async function sendTest(id: string) {
      const toastId = toast.loading("Enviando e-mail de teste…")
      const result = await sendTestMessageTemplate(id)
      if (result.success) toast.success(result.message, { id: toastId })
      else toast.error(result.error, { id: toastId })
    }

    const cols: ColumnDef<MessageTemplateRow>[] = [
      createSelectColumn<MessageTemplateRow>(),
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? <ColorBadge label="Ativo" color="#22c55e" /> : <ColorBadge label="Inativo" color="#6b7280" />,
      },
      {
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => (
          <Link href={`${BASE_HREF}/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "channel",
        header: "Canal",
        cell: ({ row }) => (
          <ColorBadge label={MESSAGE_CHANNEL_LABELS[row.original.channel]} color={MESSAGE_CHANNEL_COLORS[row.original.channel]} />
        ),
      },
      {
        accessorKey: "event",
        header: "Evento",
        cell: ({ row }) => MESSAGE_EVENT_LABELS[row.original.event],
      },
      {
        id: "subject",
        header: "Assunto",
        cell: ({ row }) => (
          <span className="block max-w-80 truncate text-muted-foreground" title={row.original.subject}>
            {row.original.channel === "EMAIL" ? row.original.subject : "—"}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Atualizado em",
        cell: ({ row }) => <DateCell date={row.original.updatedAt}>{formatDate(row.original.updatedAt)}</DateCell>,
      },
    ]
    if (canUpdate || canDelete || canCreate) {
      cols.push({
        id: "actions",
        cell: ({ row }) => (
          <EntityActionsCell
            onToggleStatus={canUpdate ? () => handleToggleStatus(row.original.id, row.original.isActive) : undefined}
            isActive={row.original.isActive}
            onEdit={canUpdate ? () => router.push(`${BASE_HREF}/${row.original.id}`) : undefined}
            onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
            extraItems={
              <>
                {canCreate && (
                  <DropdownMenuItem onClick={() => duplicate(row.original.id)}>
                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                  </DropdownMenuItem>
                )}
                {row.original.channel === "EMAIL" && (
                  <DropdownMenuItem onClick={() => sendTest(row.original.id)}>
                    <Send className="mr-2 h-4 w-4" /> Enviar teste para mim
                  </DropdownMenuItem>
                )}
              </>
            }
          />
        ),
      })
    }
    return cols
  }, [canCreate, canUpdate, canDelete, router, handleToggleStatus, setDeleteDialog])

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ channel: channel || undefined, event: event || undefined, status: status || undefined, page: 1 })}
      onClear={() => {
        setChannel("")
        setEvent("")
        setStatus("")
        pushParams({ channel: undefined, event: undefined, status: undefined, page: 1 })
      }}
    >
      <FilterSelect
        label="Canal"
        value={channel}
        onChange={setChannel}
        options={Object.entries(MESSAGE_CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <FilterSelect
        label="Evento"
        value={event}
        onChange={setEvent}
        options={Object.entries(MESSAGE_EVENT_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <FilterSelect
        label="Status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "active", label: "Ativo" },
          { value: "inactive", label: "Inativo" },
        ]}
      />
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader
        title="Templates de Mensagem"
        description="Modelos de e-mail e WhatsApp usados nas notificações do sistema. Para cada evento e canal, vale o template ativo mais recente."
      />
      <DataTable
        refreshing={isPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={
          canCreate ? (
            <Link href={`${BASE_HREF}/new`} className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" /> Novo Template
            </Link>
          ) : undefined
        }
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={
          canDelete
            ? {
                getId: (row) => row.id,
                getRowLabel: (row) => row.name,
                action: bulkDeleteMessageTemplates,
                confirmDescription: (count) => `Tem certeza que deseja excluir ${count} template(s) selecionado(s)?`,
                onSuccess: () => refresh(),
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Template"
        description="Tem certeza que deseja excluir este template? Os envios passarão a usar outro template ativo do mesmo evento ou o modelo padrão."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
