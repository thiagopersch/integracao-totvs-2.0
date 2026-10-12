import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProjectById, getProjectPickerOptions } from "@/queries/projects"
import { listActiveCustomFieldDefinitions } from "@/queries/custom-fields"
import { ProjectSettingsForm } from "@/components/projects/project-settings-form"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

type PageProps = { params: Promise<{ id: string }> }

export default function ProjectSettingsPage({ params }: PageProps) {
  return (
    <div className="p-4 pt-0 md:p-6 md:pt-0">
      <Suspense fallback={<TableSkeleton />}>
        <ProjectSettingsContent params={params} />
      </Suspense>
    </div>
  )
}

async function ProjectSettingsContent({ params }: PageProps) {
  const { id } = await params
  const { organizationId, allowedClientIds, permissions } = await getRequestContext()
  // The route prefix (/projetos/gestao) only requires projects:read — editing needs its own grant.
  if (!hasPermission(permissions, "projects", "update")) notFound()
  const [project, options, defs] = await Promise.all([
    getProjectById(id, organizationId, allowedClientIds),
    getProjectPickerOptions(organizationId, allowedClientIds),
    listActiveCustomFieldDefinitions(organizationId, "PROJECT"),
  ])
  if (!project) notFound()
  return <ProjectSettingsForm key={project.updatedAt.toString()} project={project} options={options} defs={defs} />
}
