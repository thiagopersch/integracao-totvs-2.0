"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/utils/format"
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications"
import { toast } from "sonner"
import type { Notification } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface NotificationTableProps {
  data: Notification[]
  meta: PaginationMeta
  unreadCount: number
}

export function NotificationTable({ data, meta, unreadCount }: NotificationTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

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

  const columns: ColumnDef<Notification>[] = [
    {
      id: "unread",
      header: "",
      cell: ({ row }) => (!row.original.readAt ? <span className="block h-2 w-2 rounded-full bg-primary" /> : null),
    },
    { accessorKey: "title", header: "Título" },
    { accessorKey: "body", header: "Mensagem", cell: ({ row }) => <span className="line-clamp-1">{row.getValue("body")}</span> },
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => formatDate(row.getValue("createdAt") as Date),
    },
    {
      id: "actions",
      cell: ({ row }) =>
        !row.original.readAt && (
          <Button variant="ghost" size="sm" onClick={() => handleRead(row.original.id)}>
            Marcar como lida
          </Button>
        ),
    },
  ]

  return (
    <>
      <PageHeader title="Notificações" description="Suas notificações">
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
      />
    </>
  )
}
