"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { NotificationDetailDialog } from "@/components/shared/notification-detail-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { formatDate } from "@/utils/format"
import { getNotificationCategory } from "@/lib/notification-category"
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications"
import { toast } from "sonner"
import type { Notification } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface NotificationTableProps {
  data: Notification[]
  meta: PaginationMeta
  unreadCount: number
}

const SORTABLE_COLUMNS = ["title", "createdAt"]

export function NotificationTable({ data, meta, unreadCount }: NotificationTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState<Notification | null>(null)

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  const sortParam = searchParams.get("sort")
  const sort = sortParam
    ? { field: sortParam.split(":")[0], direction: sortParam.split(":")[1] as "asc" | "desc" }
    : { field: "createdAt", direction: "desc" as const }

  async function handleRead(id: string) {
    await markNotificationAsRead(id)
    router.refresh()
  }

  async function handleReadAll() {
    const result = await markAllNotificationsAsRead()
    if (result.success) {
      toast.success("Todas as notificações marcadas como lidas")
      router.refresh()
    }
  }

  function handleRowClick(notification: Notification) {
    if (!notification.readAt) handleRead(notification.id)
    setDetail(notification)
  }

  const columns: ColumnDef<Notification>[] = useMemo(() => [
    {
      id: "unread",
      header: "",
      cell: ({ row }) => (!row.original.readAt ? <span className="block h-2 w-2 rounded-full bg-primary" /> : null),
    },
    {
      id: "category",
      header: "Categoria",
      cell: ({ row }) => {
        const category = getNotificationCategory(row.original.type)
        return (
          <Badge variant="outline" className="gap-1">
            <category.icon className="h-3 w-3" />
            {category.label}
          </Badge>
        )
      },
    },
    { accessorKey: "title", header: "Título" },
    {
      accessorKey: "body",
      header: "Mensagem",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => handleRowClick(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => formatDate(row.getValue("createdAt") as Date),
    },
    {
      id: "actions",
      cell: ({ row }) =>
        !row.original.readAt && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => handleRead(row.original.id)}>
              Marcar como lida
            </Button>
          </div>
        ),
    },
  ], [handleRowClick, handleRead])

  return (
    <>
      <PageHeader title="Notificações" description="Suas notificações — clique em uma para ver todos os detalhes">
        {unreadCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{unreadCount} não lida{unreadCount !== 1 ? "s" : ""}</Badge>
            <Button variant="outline" size="sm" onClick={handleReadAll}>Marcar todas como lidas</Button>
          </div>
        )}
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchable={false}
        onRowClick={handleRowClick}
        sort={sort}
        onSortChange={(s) => pushParams({ sort: `${s.field}:${s.direction}`, page: 1 })}
        sortableColumns={SORTABLE_COLUMNS}
      />

      <NotificationDetailDialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)} notification={detail} />
    </>
  )
}
