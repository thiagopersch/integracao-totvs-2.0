import { Suspense } from "react"
import { redirect } from "next/navigation"
import { listAllPermissions } from "@/queries/admin/roles"
import { RoleForm } from "@/components/roles/role-form"
import { FormSkeleton } from "@/components/shared/skeletons"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

export default function NewRolePage() {
  return (
    <Suspense fallback={<FormSkeleton className="m-6" />}>
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
