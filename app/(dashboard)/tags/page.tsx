import { Suspense } from "react"
import { listAllTags } from "@/actions/tags"
import { TagTable } from "@/components/shared/tag-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function TagsPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TagsContent />
      </Suspense>
    </div>
  )
}

async function TagsContent() {
  const data = await listAllTags()
  return <TagTable data={data} />
}
