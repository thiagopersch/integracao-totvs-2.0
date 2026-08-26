import { Suspense } from "react"
import { listFilters, listDistinctSentenceCodes } from "@/actions/admin/filters"
import { listAllClients, listActiveClientsWithTbc } from "@/actions/admin/clients"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { listAllSistemas } from "@/actions/admin/sistemas"
import { listAllSentenceCategories } from "@/actions/admin/sentence-categories"
import { FilterTable } from "@/components/shared/filter-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function FiltersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <FiltersContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function FiltersContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const filters: Record<string, string> = {}
  if (params.status) filters.status = params.status
  if (params.clientId) filters.clientId = params.clientId
  if (params.notRequiredLicense) filters.notRequiredLicense = params.notRequiredLicense
  if (params.codColigadaSentenca) filters.codColigadaSentenca = params.codColigadaSentenca
  if (params.codSistemaSentenca) filters.codSistemaSentenca = params.codSistemaSentenca

  const [{ data, meta }, clients, tbcs, sistemas, categories, filterClients, sentenceCodes] = await Promise.all([
    listFilters({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
      filters: Object.keys(filters).length ? filters : undefined,
    }, organizationId),
    listAllClients(),
    listAllTbcs(),
    listAllSistemas(),
    listAllSentenceCategories(),
    listActiveClientsWithTbc(),
    listDistinctSentenceCodes(),
  ])

  return (
    <FilterTable
      data={data}
      meta={meta}
      clients={clients}
      tbcs={tbcs}
      sistemas={sistemas}
      categories={categories}
      filterClients={filterClients}
      sentenceCodes={sentenceCodes}
    />
  )
}
