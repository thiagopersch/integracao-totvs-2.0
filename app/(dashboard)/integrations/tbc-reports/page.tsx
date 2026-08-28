import { Suspense } from "react"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { listAllSistemas } from "@/actions/admin/sistemas"
import { Skeleton } from "@/components/ui/skeleton"
import { TbcReportsClient } from "./tbc-reports-client"

export default function TbcReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full m-6" />}>
      <TbcReportsContent />
    </Suspense>
  )
}

async function TbcReportsContent() {
  const [tbcs, sistemas] = await Promise.all([listAllTbcs(), listAllSistemas()])

  return (
    <TbcReportsClient
      initialTbcs={tbcs.map((t) => ({ id: t.id, name: t.name, link: t.link }))}
      initialSistemas={sistemas.map((s) => ({
        id: s.id,
        code: s.code,
        internalName: s.internalName,
        externalName: s.externalName,
      }))}
    />
  )
}
