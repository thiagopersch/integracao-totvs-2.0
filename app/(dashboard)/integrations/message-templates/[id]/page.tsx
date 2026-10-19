import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getMessageTemplate } from "@/actions/message-templates"
import { TemplateBuilder } from "@/components/message-templates/builder/template-builder"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"
import type { BlockTree } from "@/lib/message-templates/block-types"
import { parseTemplateAttachments } from "@/lib/message-templates/attachments"

export default function EditMessageTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <EditMessageTemplateContent params={params} />
    </Suspense>
  )
}

async function EditMessageTemplateContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [template, ctx] = await Promise.all([getMessageTemplate(id), getRequestContext()])
  if (!template) notFound()

  return (
    <TemplateBuilder
      canSave={hasPermission(ctx.permissions, "message_templates", "update")}
      template={{
        id: template.id,
        name: template.name,
        channel: template.channel,
        event: template.event,
        scope: template.scope,
        subject: template.subject,
        content: (Array.isArray(template.content) ? template.content : []) as unknown as BlockTree,
        attachments: parseTemplateAttachments(template.attachments),
        bodyText: template.bodyText,
        isActive: template.isActive,
      }}
    />
  )
}
