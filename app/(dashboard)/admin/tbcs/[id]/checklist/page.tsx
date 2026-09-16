import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTbcById } from "@/actions/admin/tbcs"
import { listAllDataservers } from "@/actions/admin/dataservers"
import { TbcChecklistClient } from "@/components/tbc-checklist/tbc-checklist-client"
import { TbcChecklistSkeleton } from "@/components/tbc-checklist/tbc-checklist-skeleton"
import { getRequestContext } from "@/lib/tenant"

export default function TbcChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-6">
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
