import { Suspense } from "react"
import { listTbcs } from "@/actions/admin/tbcs"
import { TbcTable } from "@/components/shared/tbc-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function TbcsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TbcsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function TbcsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const filters: Record<string, string> = {}
  if (params.status) filters.status = params.status
  if (params.clientId) filters.clientId = params.clientId
  if (params.notRequiredLicense) filters.notRequiredLicense = params.notRequiredLicense

  const { data, meta } = await listTbcs({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: Object.keys(filters).length ? filters : undefined,
  }, organizationId)

  return <TbcTable data={data} meta={meta} />
}
