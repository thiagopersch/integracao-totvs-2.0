import { Suspense } from "react"
import { listContracts } from "@/actions/contracts"
import { listAllClients } from "@/actions/admin/clients"
import { ContractTable } from "@/components/shared/contract-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ContractsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ContractsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const [{ data, meta }, clients] = await Promise.all([
    listContracts(
      {
        page: Number(params.page) || 1,
        pageSize: Number(params.pageSize) || 10,
        search: params.search,
        sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
        filters: params.status ? { status: params.status } : undefined,
      },
      organizationId
    ),
    listAllClients(),
  ])

  return <ContractTable data={data} meta={meta} clients={clients} />
}
