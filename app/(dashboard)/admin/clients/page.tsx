import { Suspense } from "react"
import { listClients } from "@/actions/admin/clients"
import { ClientTable } from "@/components/shared/client-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ClientsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ClientsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { data, meta } = await listClients({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  })

  return <ClientTable data={data} meta={meta} />
}
