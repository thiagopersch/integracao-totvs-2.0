import { Suspense } from "react"
import { getAiSettings } from "@/actions/integrations/ai-settings"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { AiSettingsClient } from "./ai-settings-client"

export default function AiSettingsPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <AiSettingsContent />
    </Suspense>
  )
}

async function AiSettingsContent() {
  const settings = await getAiSettings()
  return <AiSettingsClient initialSettings={settings} />
}
