import { Suspense } from "react"
import { listSentences } from "@/actions/admin/sentences"
import { SentenceTable } from "@/components/shared/sentence-table"
import { Skeleton } from "@/components/ui/skeleton"

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
  const { data, meta } = await listSentences({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  })

  return <SentenceTable data={data} meta={meta} />
}
