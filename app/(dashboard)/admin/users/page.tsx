import { Suspense } from "react"
import { listUsers } from "@/actions/admin/users"
import { UsersTable } from "@/components/shared/users-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <UsersContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function UsersContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const { data, meta } = await listUsers({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status || params.role ? { status: params.status, role: params.role } : undefined,
  }, organizationId)

  return <UsersTable data={data} meta={meta} />
}
