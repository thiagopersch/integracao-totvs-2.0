import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProjectPickerOptions } from "@/queries/projects"
import { listActiveCustomFieldDefinitions } from "@/queries/custom-fields"
import { ProjectSettingsForm } from "@/components/projects/project-settings-form"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

export default function NewProjectPage() {
  return (
    <div className="p-4 pt-0 md:p-6 md:pt-0">
      <Suspense fallback={<TableSkeleton />}>
        <NewProjectContent />
      </Suspense>
    </div>
  )
}

async function NewProjectContent() {
  const { organizationId, allowedClientIds, permissions } = await getRequestContext()
  // The route prefix (/projetos/gestao) only requires projects:read — creating needs its own grant.
  if (!hasPermission(permissions, "projects", "create")) notFound()
  const [options, defs] = await Promise.all([
    getProjectPickerOptions(organizationId, allowedClientIds),
    listActiveCustomFieldDefinitions(organizationId, "PROJECT"),
  ])
  return <ProjectSettingsForm options={options} defs={defs} />
}
