import { Suspense } from "react"
import { listDepartments } from "@/actions/departments"
import { DepartmentTable } from "@/components/shared/department-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function DepartmentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <DepartmentsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DepartmentsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const { data, meta } = await listDepartments({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
  }, organizationId)

  return <DepartmentTable data={data} meta={meta} />
}
