import { Suspense } from "react"
import { requirePermission } from "@/lib/rbac"
import { listAllClients } from "@/actions/admin/clients"
import { listAllAnalysts } from "@/actions/analysts"
import { listAllRequesters } from "@/actions/requesters"
import { listAllDepartments } from "@/actions/departments"
import { listAllDemandTypes } from "@/actions/demand-types"
import { DemandImportForm } from "@/components/shared/demand-import-form"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"

export default function DemandsImportPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Importar Demandas" description="Importar demandas a partir de uma planilha XLSX ou CSV" />
      <Suspense fallback={<Skeleton className="h-64 max-w-xl w-full" />}>
        <DemandsImportContent />
      </Suspense>
    </div>
  )
}

async function DemandsImportContent() {
  await requirePermission("demands", "create")
  const [clients, analysts, requesters, departments, demandTypes] = await Promise.all([
    listAllClients(),
    listAllAnalysts(),
    listAllRequesters(),
    listAllDepartments(),
    listAllDemandTypes(),
  ])

  return (
    <DemandImportForm clients={clients} analysts={analysts} requesters={requesters} departments={departments} demandTypes={demandTypes} />
  )
}
