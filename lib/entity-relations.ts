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

type CountDelegate = {
  count(args: { where: Record<string, unknown> }): Promise<number>;
  groupBy(args: { by: string[]; where: Record<string, unknown>; _count: true }): Promise<Array<Record<string, unknown> & { _count: number }>>;
};

function referenceWhere(ref: (typeof SCHEMA_RELATIONS)[number], idFilter: unknown): Record<string, unknown> {
  const where: Record<string, unknown> = { [ref.fkField]: idFilter };
  if (ref.hasDeletedAt) where.deletedAt = null;
  const parent = SOFT_DELETED_PARENT[ref.modelName];
  if (parent) where[parent] = { deletedAt: null };
  return where;
}

function referencingDelegates(targetModelName: string, ignoreModels?: string[]) {
  const ignore = new Set(ignoreModels ?? []);
  return findReferencingFields(targetModelName)
    .filter((ref) => !ignore.has(ref.modelName))
    .map((ref) => ({ ref, delegate: (prisma as unknown as Record<string, CountDelegate>)[ref.delegateName] }))
    .filter((entry) => Boolean(entry.delegate));
}

/**
 * Returns which other registries still hold live rows pointing at `id` —
 * an empty array means the record is free to be (soft) deleted. `ignoreModels` skips
 * child models the caller cleans up itself (e.g. a task's checklist items, which have
 * no `deletedAt` and would otherwise always block).
 *
 * The per-model counts run in parallel (they used to run one after another — ~20 round trips for
 * a Client).
 */
export async function findBlockingReferences(
  targetModelName: string,
  id: string,
  options?: { ignoreModels?: string[] },
): Promise<BlockingReference[]> {
  const entries = referencingDelegates(targetModelName, options?.ignoreModels);
  const counts = await Promise.all(entries.map(({ ref, delegate }) => delegate.count({ where: referenceWhere(ref, id) })));
  const results: BlockingReference[] = [];
  entries.forEach(({ ref }, i) => {
    if (counts[i] > 0) {
      results.push({ model: ref.modelName, label: ENTITY_LABELS[ref.modelName] ?? ref.modelName, field: ref.fkField, count: counts[i] });
    }
  });
  return results;
}

/**
 * Batch version of {@link findBlockingReferences} for bulk deletes: one `GROUP BY fk` query per
 * referencing model for all ids at once, instead of one count per (id × model). Ids that are free
 * to delete are absent from the returned map.
 */
export async function findBlockingReferencesMany(
  targetModelName: string,
  ids: string[],
  options?: { ignoreModels?: string[] },
): Promise<Map<string, BlockingReference[]>> {
  const byId = new Map<string, BlockingReference[]>();
  if (ids.length === 0) return byId;
  const entries = referencingDelegates(targetModelName, options?.ignoreModels);
  const grouped = await Promise.all(
    entries.map(({ ref, delegate }) =>
      delegate.groupBy({ by: [ref.fkField], where: referenceWhere(ref, { in: ids }), _count: true }),
    ),
  );
  entries.forEach(({ ref }, i) => {
    for (const row of grouped[i]) {
      const id = row[ref.fkField] as string;
      const count = typeof row._count === "number" ? row._count : Number((row._count as unknown as { _all?: number })._all ?? 0);
      if (count <= 0) continue;
      const list = byId.get(id) ?? [];
      list.push({ model: ref.modelName, label: ENTITY_LABELS[ref.modelName] ?? ref.modelName, field: ref.fkField, count });
      byId.set(id, list);
    }
  });
  return byId;
}
