import { Suspense } from "react"
import { getEmailSettings } from "@/actions/integrations/email-settings"
import { FormSkeleton } from "@/components/shared/skeletons"
import { EmailSettingsClient } from "./email-settings-client"

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<FormSkeleton className="m-6" />}>
      <EmailSettingsContent />
    </Suspense>
  )
}

async function EmailSettingsContent() {
  const settings = await getEmailSettings()
  return <EmailSettingsClient initialSettings={settings} />
}
