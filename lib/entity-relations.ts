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

type CountDelegate = { count(args: { where: Record<string, unknown> }): Promise<number> };

/**
 * Returns which other registries still hold live rows pointing at `id` —
 * an empty array means the record is free to be (soft) deleted.
 */
export async function findBlockingReferences(targetModelName: string, id: string): Promise<BlockingReference[]> {
  const refs = findReferencingFields(targetModelName);
  const results: BlockingReference[] = [];

  for (const ref of refs) {
    const delegate = (prisma as unknown as Record<string, CountDelegate>)[ref.delegateName];
    if (!delegate) continue;

    const where: Record<string, unknown> = { [ref.fkField]: id };
    if (ref.hasDeletedAt) where.deletedAt = null;

    const count = await delegate.count({ where });
    if (count > 0) {
      results.push({ model: ref.modelName, label: ENTITY_LABELS[ref.modelName] ?? ref.modelName, field: ref.fkField, count });
    }
  }

  return results;
}
