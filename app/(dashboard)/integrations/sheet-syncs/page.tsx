import { Suspense } from "react"
import { getSheetSyncsPageData } from "@/actions/demand-sheet-syncs"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MigrationPendingNotice } from "@/components/shared/migration-pending-notice"
import { isMissingTableError, logMigrationPending } from "@/lib/prisma-errors"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"
import { SheetSyncsClient } from "./sheet-syncs-client"

export default function SheetSyncsPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <SheetSyncsContent />
    </Suspense>
  )
}

async function SheetSyncsContent() {
  let data: Awaited<ReturnType<typeof getSheetSyncsPageData>>
  try {
    data = await getSheetSyncsPageData()
  } catch (error) {
    if (!isMissingTableError(error)) throw error
    logMigrationPending("Planilhas Google", error)
    return <MigrationPendingNotice feature="As Planilhas Google" />
  }
  const ctx = await getRequestContext()
  return (
    <SheetSyncsClient
      syncs={data.syncs.map((s) => ({
        id: s.id,
        name: s.name,
        spreadsheetUrl: s.spreadsheetUrl,
        period: s.period,
        clientIds: s.clientIds,
        analystIds: s.analystIds,
        schedule: s.schedule,
        scheduleTime: s.scheduleTime,
        dayOfMonth: s.dayOfMonth,
        syncOnDemandChange: s.syncOnDemandChange,
        isActive: s.isActive,
        nextRunAt: s.nextRunAt?.toISOString() ?? null,
        pendingSyncAt: s.pendingSyncAt?.toISOString() ?? null,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastRunStatus: s.lastRunStatus,
        lastRunMessage: s.lastRunMessage,
      }))}
      clients={data.clients}
      analysts={data.analysts}
      google={data.google}
      canManageGoogle={data.canManageGoogle}
      permissions={{
        create: hasPermission(ctx.permissions, "sheet_syncs", "create"),
        update: hasPermission(ctx.permissions, "sheet_syncs", "update"),
        delete: hasPermission(ctx.permissions, "sheet_syncs", "delete"),
        execute: hasPermission(ctx.permissions, "sheet_syncs", "execute"),
      }}
    />
  )
}
