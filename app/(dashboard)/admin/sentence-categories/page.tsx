import { Suspense } from "react"
import { listSentenceCategories } from "@/actions/admin/sentence-categories"
import { SentenceCategoryTable } from "@/components/shared/sentence-category-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function SentenceCategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SentenceCategoriesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SentenceCategoriesContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { data, meta } = await listSentenceCategories({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  })

  return <SentenceCategoryTable data={data} meta={meta} />
}
