import { Suspense } from "react"
import { listUsers } from "@/actions/admin/users"
import { listAllClientsForAssignment } from "@/actions/admin/clients"
import { UsersTable } from "@/components/shared/users-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

export default function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function UsersContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { organizationId, permissions } = await getRequestContext()
  const canAssignClients = hasPermission(permissions, "users", "update")

  const [{ data, meta }, clients] = await Promise.all([
    listUsers({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
      filters: params.status || params.role ? { status: params.status, role: params.role } : undefined,
    }, organizationId),
    canAssignClients ? listAllClientsForAssignment() : Promise.resolve([]),
  ])

  return <UsersTable data={data} meta={meta} clients={clients} />
}
