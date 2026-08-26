import { Suspense } from "react"
import { listAllSoapEndpointTypes } from "@/actions/admin/soap-endpoints"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { Skeleton } from "@/components/ui/skeleton"
import { SoapBuilderClient } from "./soap-builder-client"

export default function SoapBuilderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full m-6" />}>
      <SoapBuilderContent />
    </Suspense>
  )
}

async function SoapBuilderContent() {
  const [endpointTypes, tbcs] = await Promise.all([listAllSoapEndpointTypes(), listAllTbcs()])

  return (
    <SoapBuilderClient
      initialEndpointTypes={endpointTypes}
      initialTbcs={tbcs.map((tbc) => ({
        id: tbc.id,
        name: tbc.name,
        link: tbc.link,
        notRequiredLicense: tbc.notRequiredLicense,
        client: tbc.client ?? null,
      }))}
    />
  )
}
