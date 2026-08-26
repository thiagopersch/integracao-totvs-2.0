import { Suspense } from "react"
import { endOfDay } from "date-fns"
import { soapService, type SoapHistoryFilters } from "@/services/soap.service"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { tbcService } from "@/services/tbc.service"
import { clientService } from "@/services/client.service"
import { SoapHistoryTable } from "@/components/soap/soap-history-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"
import type { SoapMethod } from "@prisma/client"

export default function SoapHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SoapHistoryContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SoapHistoryContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()

  const filters: SoapHistoryFilters = {
    clientId: params.clientId || undefined,
    tbcId: params.tbcId || undefined,
    endpointTypeId: params.endpointTypeId || undefined,
    method: (params.method as SoapMethod) || undefined,
    status: params.status ? params.status.split(",").map(Number) : undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? endOfDay(new Date(params.dateTo)) : undefined,
    minDurationMs: params.minDuration ? Number(params.minDuration) * 1000 : undefined,
  }

  const [{ data, meta }, clients, tbcs, endpointTypes, statuses] = await Promise.all([
    soapService.getHistory(organizationId, Number(params.page) || 1, Number(params.pageSize) || 10, params.search, filters),
    clientService.listActiveWithTbc(organizationId),
    tbcService.listAll(organizationId),
    soapEndpointService.listAllTypes(),
    soapService.listDistinctStatuses(organizationId),
  ])

  return (
    <SoapHistoryTable
      data={data}
      meta={meta}
      clients={clients}
      tbcs={tbcs}
      endpointTypes={endpointTypes}
      statuses={statuses}
    />
  )
}
