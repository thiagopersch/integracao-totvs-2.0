import { Suspense } from "react"
import { requirePermission } from "@/lib/rbac"
import { listAllClients } from "@/actions/admin/clients"
import { getDemandPeriodOptions } from "@/actions/demands"
import { DemandExportForm } from "@/components/shared/demand-export-form"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"

export default function DemandsExportPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Exportar Demandas" description="Exportar demandas em PDF ou XLSX" />
      <Suspense fallback={<Skeleton className="h-64 max-w-xl w-full" />}>
        <DemandsExportContent />
      </Suspense>
    </div>
  )
}

async function DemandsExportContent() {
  await requirePermission("reports", "read")
  const [clients, periodOptions] = await Promise.all([listAllClients(), getDemandPeriodOptions()])

  return <DemandExportForm clients={clients} years={periodOptions.years} monthsByYear={periodOptions.monthsByYear} />
}
