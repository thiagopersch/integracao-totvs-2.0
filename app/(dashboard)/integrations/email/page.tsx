import { Suspense } from "react"
import { getEmailSettings } from "@/actions/integrations/email-settings"
import { Skeleton } from "@/components/ui/skeleton"
import { EmailSettingsClient } from "./email-settings-client"

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full m-6" />}>
      <EmailSettingsContent />
    </Suspense>
  )
}

async function EmailSettingsContent() {
  const settings = await getEmailSettings()
  return <EmailSettingsClient initialSettings={settings} />
}
