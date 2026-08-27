import { Suspense } from "react"
import { listAllSoapEndpointTypes } from "@/actions/admin/soap-endpoints"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { listActiveClientsWithTbc } from "@/actions/admin/clients"
import { listAllSistemas } from "@/actions/admin/sistemas"
import { listAllDataservers } from "@/actions/admin/dataservers"
import { listAllProcesses } from "@/actions/admin/processes"
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
  const [endpointTypes, tbcs, clients, sistemas, dataservers, processes] = await Promise.all([
    listAllSoapEndpointTypes(),
    listAllTbcs(),
    listActiveClientsWithTbc(),
    listAllSistemas(),
    listAllDataservers(),
    listAllProcesses(),
  ])

  return (
    <SoapBuilderClient
      initialEndpointTypes={endpointTypes}
      initialTbcs={tbcs.map((tbc) => ({
        id: tbc.id,
        name: tbc.name,
        link: tbc.link,
        user: tbc.user,
        notRequiredLicense: tbc.notRequiredLicense,
        client: tbc.client ?? null,
      }))}
      initialClients={clients.map((c) => ({ id: c.id, name: c.name }))}
      initialSistemas={sistemas.map((s) => ({ id: s.id, code: s.code, internalName: s.internalName, externalName: s.externalName }))}
      initialDataservers={dataservers.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
      initialProcesses={processes.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
    />
  )
}
