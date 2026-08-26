"use client"

import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { ENTITY_LABELS, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations"
import type { PaginationMeta } from "@/types/common"
import type { AuditLog } from "@prisma/client"

type DeletionErrorRow = AuditLog & {
  user: { id: string; name: string; email: string } | null
}

interface DeletionLogTableProps {
  data: DeletionErrorRow[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["createdAt", "entity", "entityId"]

export function DeletionLogTable({ data, meta }: DeletionLogTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key)
      else params.set(key, String(value))
    })
    router.push(`?${params.toString()}`)
  }

  const sortParam = searchParams.get("sort")
  const sort = sortParam
    ? { field: sortParam.split(":")[0], direction: sortParam.split(":")[1] as "asc" | "desc" }
    : { field: "createdAt", direction: "desc" as const }

  const columns: ColumnDef<DeletionErrorRow>[] = [
    {
      accessorKey: "createdAt",
      header: "Data/Hora",
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    },
    {
      accessorKey: "entity",
      header: "Cadastro",
      cell: ({ row }) => <Badge variant="secondary">{ENTITY_LABELS[row.original.entity] ?? row.original.entity}</Badge>,
    },
    {
      accessorKey: "entityId",
      header: "Registro",
      cell: ({ row }) => <span className="font-jetbrains text-xs">{row.original.entityId}</span>,
    },
    {
      id: "reasons",
      header: "Motivo / Vinculado a",
      cell: ({ row }) => {
        const reasons = (row.original.newData as { reasons?: BlockingReference[] } | null)?.reasons ?? []
        return formatBlockingReferences(reasons) || "-"
      },
    },
    {
      id: "user",
      header: "Usuário",
      cell: ({ row }) => row.original.user?.name ?? "-",
    },
  ]

  return (
    <>
      <PageHeader
        title="Logs de Exclusão"
        description="Registros que não puderam ser excluídos por estarem vinculados a outros cadastros"
      />

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
        emptyMessage="Nenhum registro bloqueado encontrado."
        sort={sort}
        onSortChange={(s) => pushParams({ sort: `${s.field}:${s.direction}`, page: 1 })}
        sortableColumns={SORTABLE_COLUMNS}
      />
    </>
  )
}
