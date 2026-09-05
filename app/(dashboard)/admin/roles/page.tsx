import { Suspense } from "react"
import { listRoles, listAllPermissions } from "@/actions/admin/roles"
import { RoleTable } from "@/components/shared/role-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function RolesPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <RolesContent />
      </Suspense>
    </div>
  )
}

async function RolesContent() {
  const organizationId = await getCurrentOrganizationId()
  const [roles, permissions] = await Promise.all([listRoles(organizationId), listAllPermissions()])

  return <RoleTable data={roles} permissions={permissions} />
}
