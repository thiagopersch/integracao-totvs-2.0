import { Suspense } from "react"
import { getAiSettings } from "@/actions/integrations/ai-settings"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { MigrationPendingNotice } from "@/components/shared/migration-pending-notice"
import { isMissingTableError, logMigrationPending } from "@/lib/prisma-errors"
import { AiSettingsClient } from "./ai-settings-client"

export default function AiSettingsPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <AiSettingsContent />
    </Suspense>
  )
}

async function AiSettingsContent() {
  let settings: Awaited<ReturnType<typeof getAiSettings>>
  try {
    settings = await getAiSettings()
  } catch (error) {
    if (!isMissingTableError(error)) throw error
    logMigrationPending("Assistente IA", error)
    return <MigrationPendingNotice feature="O Assistente IA" />
  }
  return <AiSettingsClient initialSettings={settings} />
}
