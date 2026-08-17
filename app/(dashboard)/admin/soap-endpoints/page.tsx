import { Suspense } from "react"
import { listSoapEndpointTypes } from "@/actions/admin/soap-endpoints"
import { SoapEndpointTable } from "@/components/shared/soap-endpoint-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function SoapEndpointsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
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
  const { data, meta } = await listSoapEndpointTypes({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort
      ? {
          field: params.sort.split(":")[0],
          direction: params.sort.split(":")[1] as "asc" | "desc",
        }
      : undefined,
    filters: params.status ? { status: params.status } : undefined,
  })

  return <SoapEndpointTable data={data} meta={meta} />
}
