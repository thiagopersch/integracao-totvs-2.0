import { Suspense } from "react"
import { getIntegrationSettings } from "@/actions/integrations/integration-settings"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MigrationPendingNotice } from "@/components/shared/migration-pending-notice"
import { isMissingTableError, logMigrationPending } from "@/lib/prisma-errors"
import { IntegrationSettingsClient } from "./integration-settings-client"

export default function IntegrationSettingsPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <IntegrationSettingsContent />
    </Suspense>
  )
}

async function IntegrationSettingsContent() {
  let rows: Awaited<ReturnType<typeof getIntegrationSettings>>
  try {
    rows = await getIntegrationSettings()
  } catch (error) {
    if (!isMissingTableError(error)) throw error
    logMigrationPending("Configurações de integrações", error)
    return <MigrationPendingNotice feature="As configurações de integrações" />
  }
  return <IntegrationSettingsClient rows={rows} />
}
