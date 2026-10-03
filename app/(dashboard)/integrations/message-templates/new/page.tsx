import { Suspense } from "react"
import { redirect } from "next/navigation"
import { TemplateBuilder } from "@/components/message-templates/builder/template-builder"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

export default function NewMessageTemplatePage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <NewMessageTemplateContent />
    </Suspense>
  )
}

async function NewMessageTemplateContent() {
  const { permissions } = await getRequestContext()
  if (!hasPermission(permissions, "message_templates", "create")) redirect("/integrations/message-templates")
  return <TemplateBuilder template={null} canSave />
}
