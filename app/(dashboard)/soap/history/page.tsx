import { Suspense } from "react"
import { soapService } from "@/services/soap.service"
import { SoapHistoryTable } from "@/components/soap/soap-history-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

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
  const { data, meta } = await soapService.getHistory(
    organizationId,
    Number(params.page) || 1,
    Number(params.pageSize) || 20,
    params.search
  )

  return <SoapHistoryTable data={data} meta={meta} />
}
