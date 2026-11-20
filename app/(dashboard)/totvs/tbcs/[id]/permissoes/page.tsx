import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getTbcById } from "@/queries/admin/tbcs"
import { getRequestContext } from "@/lib/tenant"
import { PERMISSION_MODELS } from "@/config/tbc-permission-models"
import { TbcPermissionsClient } from "@/components/tbc-permissions/tbc-permissions-client"
import { TableSkeleton } from "@/components/shared/table-skeleton"

type PageProps = {
  params: Promise<{ id: string }>
}

export default function TbcPermissionsPage({ params }: PageProps) {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<TableSkeleton />}>
        <TbcPermissionsContent params={params} />
      </Suspense>
    </div>
  )
}

async function TbcPermissionsContent({ params }: PageProps) {
  const { id } = await params
  const { organizationId, allowedClientIds } = await getRequestContext()
  const tbc = await getTbcById(id, organizationId, allowedClientIds)
  if (!tbc) notFound()

  return <TbcPermissionsClient tbc={tbc} models={PERMISSION_MODELS} />
}
