import { Suspense } from "react"
import { listRoles, listAllPermissions } from "@/actions/admin/roles"
import { RoleTable } from "@/components/shared/role-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function RolesPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <RolesContent />
      </Suspense>
    </div>
  )
}

async function RolesContent() {
  const organizationId = await getCurrentOrganizationId()
  const [roles, permissions] = await Promise.all([listRoles(organizationId), listAllPermissions()])

  return <RoleTable data={roles as any} permissions={permissions as any} />
}
