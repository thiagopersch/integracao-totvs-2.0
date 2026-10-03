import { Suspense } from "react"
import { listMessageTemplates } from "@/actions/message-templates"
import { MessageTemplateTable } from "@/components/message-templates/message-template-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function MessageTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <MessageTemplatesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function MessageTemplatesContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const filters = Object.fromEntries(
    (["channel", "event", "status"] as const).filter((key) => params[key]).map((key) => [key, params[key]])
  )
  const { data, meta } = await listMessageTemplates(
    {
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
      filters: Object.keys(filters).length ? filters : undefined,
    },
    organizationId
  )

  return <MessageTemplateTable data={data} meta={meta} />
}
