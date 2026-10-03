import { Suspense } from "react"
import { redirect } from "next/navigation"
import { listAllPermissions } from "@/actions/admin/roles"
import { RoleForm } from "@/components/roles/role-form"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

export default function NewRolePage() {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <NewRoleContent />
    </Suspense>
  )
}

async function NewRoleContent() {
  const { permissions: userPermissions } = await getRequestContext()
  if (!hasPermission(userPermissions, "roles", "create")) redirect("/admin/roles")
  const permissions = await listAllPermissions()
  return <RoleForm role={null} permissions={permissions} canSave />
}
