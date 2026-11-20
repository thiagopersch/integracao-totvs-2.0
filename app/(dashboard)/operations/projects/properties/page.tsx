import { Suspense } from "react"
import { listActiveCustomFieldDefinitions, listCustomFieldDefinitions } from "@/queries/custom-fields"
import { CustomFieldDefinitionTable } from "@/components/projects/custom-field-definition-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"

export default function CustomFieldsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<TableSkeleton />}>
        <CustomFieldsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function CustomFieldsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { organizationId } = await getRequestContext()
  const [{ data, meta }, projectFields, taskFields] = await Promise.all([
    listCustomFieldDefinitions(
      {
        page: Number(params.page) || 1,
        pageSize: Number(params.pageSize) || 10,
        search: params.search,
        sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
        filters: { entity: params.entity, type: params.type, status: params.status },
      },
      organizationId
    ),
    listActiveCustomFieldDefinitions(organizationId, "PROJECT"),
    listActiveCustomFieldDefinitions(organizationId, "TASK"),
  ])

  return <CustomFieldDefinitionTable data={data} meta={meta} orderLists={{ PROJECT: projectFields, TASK: taskFields }} />
}
