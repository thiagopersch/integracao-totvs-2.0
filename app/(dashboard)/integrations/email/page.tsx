import { Suspense } from "react"
import { getEmailSettings } from "@/actions/integrations/email-settings"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { EmailSettingsClient } from "./email-settings-client"

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <EmailSettingsContent />
    </Suspense>
  )
}

async function EmailSettingsContent() {
  const settings = await getEmailSettings()
  return <EmailSettingsClient initialSettings={settings} />
}
