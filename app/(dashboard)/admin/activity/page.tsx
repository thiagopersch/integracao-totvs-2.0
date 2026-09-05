import { Suspense } from "react"
import { redirect } from "next/navigation"
import { endOfDay } from "date-fns"
import {
  listActivityLog,
  listActivityTipoOptions,
  listActivityApiMethods,
  listActivityStatusCodes,
} from "@/actions/admin/activity-log"
import { listAllDataservers } from "@/actions/admin/dataservers"
import { listAllProcesses } from "@/actions/admin/processes"
import { ActivityLogTable } from "@/components/shared/activity-log-table"
import { PageHeader } from "@/components/shared/page-header"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"
import { soapEndpointService } from "@/services/soap-endpoint.service"
import { tbcService } from "@/services/tbc.service"
import { clientService } from "@/services/client.service"
import { SoapMethod } from "@/generated/prisma/client"
import type { ActivitySource } from "@/services/activity-log.service"

export default function ActivityLogPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <PageHeader
        title="Rastreamento de Atividades"
        description="CRUD, chamadas SOAP, e-mails, integrações externas e exclusões bloqueadas — tudo em uma única grade"
      />
      <Suspense fallback={<TableSkeleton />}>
        <ActivityPageBody searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ActivityPageBody({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { permissions, organizationId, allowedClientIds } = await getRequestContext()

  if (!hasPermission(permissions, "activity_logs", "read")) {
    redirect("/dashboard")
  }
  const canReexecuteSoap = hasPermission(permissions, "soap", "execute")

  const filters = {
    source: (params.source as ActivitySource) || undefined,
    clientId: params.clientId || undefined,
    tbcId: params.tbcId || undefined,
    tipo: params.tipo || undefined,
    method: params.method || undefined,
    dataserverProcess: params.dataserverProcess || undefined,
    status: params.status ? params.status.split(",").filter(Boolean) : undefined,
    minDurationMs: params.minDuration ? Number(params.minDuration) * 1000 : undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? endOfDay(new Date(params.dateTo)) : undefined,
    search: params.search || undefined,
  }

  const sort = params.sort
    ? { field: "createdAt" as const, direction: params.sort.split(":")[1] as "asc" | "desc" }
    : undefined

  const [{ data, meta }, clients, tbcs, endpointTypes, tipoOptions, apiMethods, dataservers, processes, statusCodes] =
    await Promise.all([
      listActivityLog(Number(params.page) || 1, Number(params.pageSize) || 10, filters, sort),
      clientService.listActiveWithTbc(organizationId, allowedClientIds),
      tbcService.listAll(organizationId, allowedClientIds),
      soapEndpointService.listAllTypes(),
      listActivityTipoOptions(),
      listActivityApiMethods(),
      listAllDataservers(),
      listAllProcesses(),
      listActivityStatusCodes(),
    ])

  const methodOptions = [
    ...Object.values(SoapMethod).map((m) => ({ value: m, label: m })),
    ...apiMethods.map((m: string) => ({ value: m, label: m })),
  ]

  return (
    <ActivityLogTable
      data={data}
      meta={meta}
      clients={clients}
      tbcs={tbcs}
      endpointTypes={endpointTypes}
      tipoOptions={tipoOptions}
      methodOptions={methodOptions}
      dataservers={dataservers}
      processes={processes}
      statusCodes={statusCodes}
      canReexecuteSoap={canReexecuteSoap}
    />
  )
}
