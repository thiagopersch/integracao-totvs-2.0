import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getRole } from "@/actions/admin/roles"
import { listAllPermissions } from "@/queries/admin/roles"
import { RoleForm } from "@/components/roles/role-form"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<TableSkeleton className="m-6" />}>
      <EditRoleContent params={params} />
    </Suspense>
  )
}

async function EditRoleContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [role, permissions, ctx] = await Promise.all([getRole(id), listAllPermissions(), getRequestContext()])
  if (!role) notFound()

  return (
    <RoleForm
      canSave={hasPermission(ctx.permissions, "roles", "update")}
      permissions={permissions}
      role={{
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissionIds: role.rolePermissions.map((rp) => rp.permissionId),
      }}
    />
  )
}
