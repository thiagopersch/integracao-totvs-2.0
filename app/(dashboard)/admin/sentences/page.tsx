import { Suspense } from "react"
import { listSentences } from "@/actions/admin/sentences"
import { listAllSentenceCategories } from "@/actions/admin/sentence-categories"
import { SentenceTable } from "@/components/shared/sentence-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function SentencesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SentencesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SentencesContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const [{ data, meta }, categories] = await Promise.all([
    listSentences({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
      filters: params.status || params.sentenceCategoryId ? { status: params.status, sentenceCategoryId: params.sentenceCategoryId } : undefined,
    }, organizationId),
    listAllSentenceCategories(),
  ])

  return <SentenceTable data={data} meta={meta} categories={categories} />
}
