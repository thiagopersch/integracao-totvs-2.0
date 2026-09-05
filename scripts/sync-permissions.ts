import { prisma } from "../lib/prisma";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../config/permissions";

/**
 * Safe, idempotent alternative to `prisma/seed.ts` (which wipes the whole database) for
 * production: inserts only the permissions/role-grants that are missing from `config/permissions.ts`
 * compared to what's already in the DB, never deletes or overwrites anything. Re-run any time a
 * new permission is added to the catalog (e.g. `ps_docs`) so it appears in every organization's
 * sidebar/permissions CRUD without a destructive re-seed.
 *
 * Usage: npx tsx scripts/sync-permissions.ts
 */

const SYSTEM_ROLE_NAMES: Record<keyof typeof DEFAULT_ROLE_PERMISSIONS, string> = {
  ADMIN: "admin",
  MANAGER: "manager",
  USER: "user",
};

async function main() {
  const existingPermissions = await prisma.permission.findMany({ select: { resource: true, action: true } });
  const existingPermissionKeys = new Set(existingPermissions.map((p) => `${p.resource}:${p.action}`));
  const permissionIdByKey = new Map<string, string>();
  let createdPermissions = 0;

  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: {},
      create: { resource: p.resource, action: p.action, name: p.name, description: p.description, module: p.module },
    });
    permissionIdByKey.set(`${p.resource}:${p.action}`, permission.id);
    if (!existingPermissionKeys.has(`${p.resource}:${p.action}`)) createdPermissions++;
  }
  console.log(`Permissões no catálogo: ${PERMISSIONS.length} (novas: ${createdPermissions})`);

  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  let grantsAdded = 0;

  for (const org of organizations) {
    for (const [roleKey, roleName] of Object.entries(SYSTEM_ROLE_NAMES) as [keyof typeof DEFAULT_ROLE_PERMISSIONS, string][]) {
      const role = await prisma.role.findFirst({
        where: { organizationId: org.id, name: roleName, isSystem: true },
      });
      if (!role) continue;

      const wantedKeys = DEFAULT_ROLE_PERMISSIONS[roleKey];
      const wantedPermissionIds = wantedKeys
        .map((key) => permissionIdByKey.get(key))
        .filter((id): id is string => !!id);

      const existing = await prisma.rolePermission.findMany({
        where: { roleId: role.id, permissionId: { in: wantedPermissionIds } },
        select: { permissionId: true },
      });
      const existingIds = new Set(existing.map((e) => e.permissionId));
      const missing = wantedPermissionIds.filter((id) => !existingIds.has(id));
      if (missing.length === 0) continue;

      const result = await prisma.rolePermission.createMany({
        data: missing.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
      grantsAdded += result.count;
      console.log(`  [${org.name}] +${result.count} permissões para o papel "${roleName}"`);
    }
  }

  console.log(`Vínculos de permissão adicionados: ${grantsAdded}`);
  console.log("Sincronização concluída sem apagar nenhum dado existente.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
