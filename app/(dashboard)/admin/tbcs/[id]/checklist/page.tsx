import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTbcById } from "@/queries/admin/tbcs"
import { listAllDataservers } from "@/actions/admin/dataservers"
import { TbcChecklistClient } from "@/components/tbc-checklist/tbc-checklist-client"
import { TbcChecklistSkeleton } from "@/components/tbc-checklist/tbc-checklist-skeleton"
import { getRequestContext } from "@/lib/tenant"

export default function TbcChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    // Desktop: fills the main area exactly (sidebar + content scroll independently). Below lg the two
    // panes stack and the page scrolls normally.
    <div className="flex flex-col p-4 md:p-6 lg:h-full">
      <Suspense fallback={<TbcChecklistSkeleton />}>
        <TbcChecklistContent params={params} />
      </Suspense>
    </div>
  )
}

async function TbcChecklistContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { organizationId, allowedClientIds } = await getRequestContext()

  const [tbc, dataservers] = await Promise.all([
    getTbcById(id, organizationId, allowedClientIds),
    listAllDataservers(),
  ])
  if (!tbc) notFound()

  return <TbcChecklistClient tbc={tbc} dataservers={dataservers} />
}
