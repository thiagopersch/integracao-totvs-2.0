import { Suspense } from "react"
import { listProjects, getProjectPickerOptions } from "@/queries/projects"
import { listActiveCustomFieldDefinitions } from "@/queries/custom-fields"
import { ProjectTable } from "@/components/projects/project-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { CUSTOM_FIELD_PARAM_PREFIX } from "@/lib/custom-fields"

export default function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<TableSkeleton />}>
        <ProjectsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ProjectsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { organizationId, userId, allowedClientIds } = await getRequestContext()
  const defs = await listActiveCustomFieldDefinitions(organizationId, "PROJECT")

  const filters: Record<string, string | undefined> = {
    status: params.status,
    health: params.health,
    priority: params.priority,
    clientId: params.clientId,
    managerId: params.managerId,
    mine: params.mine,
  }
  for (const def of defs) filters[`${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`] = params[`${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`]

  const [{ data, meta }, options] = await Promise.all([
    listProjects(
      {
        page: Number(params.page) || 1,
        pageSize: Number(params.pageSize) || 10,
        search: params.search,
        sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
        filters,
      },
      { organizationId, userId, allowedClientIds },
      defs
    ),
    getProjectPickerOptions(organizationId, allowedClientIds),
  ])

  return <ProjectTable data={data} meta={meta} options={options} defs={defs} />
}
