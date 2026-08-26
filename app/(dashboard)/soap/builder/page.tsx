import { Suspense } from "react"
import { listAllSoapEndpointTypes } from "@/actions/admin/soap-endpoints"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { listActiveClientsWithTbc } from "@/actions/admin/clients"
import { listAllSistemas } from "@/actions/admin/sistemas"
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
  const [endpointTypes, tbcs, clients, sistemas] = await Promise.all([
    listAllSoapEndpointTypes(),
    listAllTbcs(),
    listActiveClientsWithTbc(),
    listAllSistemas(),
  ])

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
      initialClients={clients.map((c) => ({ id: c.id, name: c.name }))}
      initialSistemas={sistemas.map((s) => ({ id: s.id, code: s.code, internalName: s.internalName, externalName: s.externalName }))}
    />
  )
}
