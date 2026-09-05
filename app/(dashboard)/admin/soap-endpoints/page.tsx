import { Suspense } from "react"
import { listSoapEndpointTypes, listSoapEndpointFilterOptions } from "@/actions/admin/soap-endpoints"
import { SoapEndpointTable } from "@/components/shared/soap-endpoint-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"

export default function SoapEndpointsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <SoapEndpointsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SoapEndpointsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const [{ data, meta }, filterOptions] = await Promise.all([
    listSoapEndpointTypes({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort
        ? {
            field: params.sort.split(":")[0],
            direction: params.sort.split(":")[1] as "asc" | "desc",
          }
        : undefined,
      filters: {
        type: params.type || undefined,
        suffix: params.suffix || undefined,
        method: params.method || undefined,
        active: params.status || undefined,
      },
    }),
    listSoapEndpointFilterOptions(),
  ])

  return <SoapEndpointTable data={data} meta={meta} filterOptions={filterOptions} />
}
