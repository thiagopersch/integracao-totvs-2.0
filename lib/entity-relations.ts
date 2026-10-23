import { SCHEMA_RELATIONS } from "@/generated/prisma-relations";
import { prisma } from "@/lib/prisma";
import { ENTITY_LABELS, type BlockingReference } from "@/lib/entity-labels";

export { ENTITY_LABELS, formatBlockingReferences, type BlockingReference } from "@/lib/entity-labels";

/**
 * Looks up every model with a foreign key pointing at `targetModelName`, from
 * the manifest scripts/generate-relations.ts derives from schema.prisma at
 * build time — no manual relation map to keep in sync as the schema grows.
 */
function findReferencingFields(targetModelName: string) {
  return SCHEMA_RELATIONS.filter((relation) => relation.targetModel === targetModelName);
}

/**
 * Link tables whose parent row is soft-deleted: a link to a deleted parent (e.g. a deleted demand's
 * analysts) no longer counts as "in use", so the deleted demand stops blocking its analyst/tag/etc.
 */
const SOFT_DELETED_PARENT: Record<string, string> = {
  DemandTag: "demand",
  DemandAnalyst: "demand",
  DemandRequester: "demand",
  DemandDepartment: "demand",
  DemandDemandType: "demand",
};

type CountDelegate = { count(args: { where: Record<string, unknown> }): Promise<number> };

/**
 * Returns which other registries still hold live rows pointing at `id` —
 * an empty array means the record is free to be (soft) deleted. `ignoreModels` skips
 * child models the caller cleans up itself (e.g. a task's checklist items, which have
 * no `deletedAt` and would otherwise always block).
 */
export async function findBlockingReferences(
  targetModelName: string,
  id: string,
  options?: { ignoreModels?: string[] },
): Promise<BlockingReference[]> {
  const ignore = new Set(options?.ignoreModels ?? []);
  const refs = findReferencingFields(targetModelName).filter((ref) => !ignore.has(ref.modelName));
  const results: BlockingReference[] = [];

  for (const ref of refs) {
    const delegate = (prisma as unknown as Record<string, CountDelegate>)[ref.delegateName];
    if (!delegate) continue;

    const where: Record<string, unknown> = { [ref.fkField]: id };
    if (ref.hasDeletedAt) where.deletedAt = null;
    const parent = SOFT_DELETED_PARENT[ref.modelName];
    if (parent) where[parent] = { deletedAt: null };

    const count = await delegate.count({ where });
    if (count > 0) {
      results.push({ model: ref.modelName, label: ENTITY_LABELS[ref.modelName] ?? ref.modelName, field: ref.fkField, count });
    }
  }

  return results;
}
