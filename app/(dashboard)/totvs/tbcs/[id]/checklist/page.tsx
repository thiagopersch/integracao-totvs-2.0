import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTbcById } from "@/queries/admin/tbcs"
import { listTbcChecklists } from "@/queries/admin/tbc-checklists"
import { listAllDataservers } from "@/actions/admin/dataservers"
import { TbcChecklistClient } from "@/components/tbc-checklist/tbc-checklist-client"
import { TbcChecklistSkeleton } from "@/components/tbc-checklist/tbc-checklist-skeleton"
import { getRequestContext } from "@/lib/tenant"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ checklist?: string | string[] }>
}

export default function TbcChecklistPage({ params, searchParams }: PageProps) {
  return (
    // Desktop: fills the main area exactly (sidebar + content scroll independently). Below lg the two
    // panes stack and the page scrolls normally.
    <div className="flex flex-col p-4 md:p-6 lg:h-full">
      <Suspense fallback={<TbcChecklistSkeleton />}>
        <TbcChecklistContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function TbcChecklistContent({ params, searchParams }: PageProps) {
  const [{ id }, { checklist }] = await Promise.all([params, searchParams])
  const { organizationId, allowedClientIds } = await getRequestContext()

  const [tbc, dataservers, checklists] = await Promise.all([
    getTbcById(id, organizationId, allowedClientIds),
    listAllDataservers(),
    listTbcChecklists(id, organizationId, allowedClientIds),
  ])
  if (!tbc) notFound()

  return (
    <TbcChecklistClient
      tbc={tbc}
      dataservers={dataservers}
      checklists={checklists}
      initialChecklistId={typeof checklist === "string" ? checklist : undefined}
    />
  )
}
