import { Suspense } from "react"
import { getReportSchedulesPageData } from "@/actions/demand-report-schedules"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"
import { ReportSchedulesClient } from "./report-schedules-client"

export default function ReportSchedulesPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <ReportSchedulesContent />
    </Suspense>
  )
}

async function ReportSchedulesContent() {
  const [data, ctx] = await Promise.all([getReportSchedulesPageData(), getRequestContext()])
  return (
    <ReportSchedulesClient
      schedules={data.schedules.map((s) => ({
        id: s.id,
        name: s.name,
        templateId: s.templateId,
        templateName: s.template.name,
        templateUsable: s.template.isActive && !s.template.deletedAt,
        period: s.period,
        clientIds: s.clientIds,
        toEmails: s.toEmails,
        ccEmails: s.ccEmails,
        sendToClientEmail: s.sendToClientEmail,
        schedule: s.schedule,
        scheduleTime: s.scheduleTime,
        dayOfMonth: s.dayOfMonth,
        isActive: s.isActive,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastRunStatus: s.lastRunStatus,
        lastRunMessage: s.lastRunMessage,
      }))}
      templates={data.templates}
      clients={data.clients}
      permissions={{
        create: hasPermission(ctx.permissions, "report_schedules", "create"),
        update: hasPermission(ctx.permissions, "report_schedules", "update"),
        delete: hasPermission(ctx.permissions, "report_schedules", "delete"),
        execute: hasPermission(ctx.permissions, "report_schedules", "execute"),
      }}
    />
  )
}
