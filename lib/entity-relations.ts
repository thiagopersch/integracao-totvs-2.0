import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Human labels for Prisma model names, reused both for "who is blocking this
 * delete" messages (referencing model) and for the entity column on the
 * centralized deletion-error log (target model).
 */
export const ENTITY_LABELS: Record<string, string> = {
  Dataserver: "Dataservers",
  Process: "Processos",
  Client: "Clientes",
  Tbc: "TBCs",
  Filter: "Filtros",
  Backup: "Backups",
  BackupRun: "Execuções de Backup",
  SentenceCategory: "Categorias de Sentença",
  Sentence: "Sentenças",
  TotvsSystem: "Sistemas TOTVS",
  User: "Usuários",
  Role: "Papéis",
  Analyst: "Analistas",
  ClientContract: "Contratos",
  Requester: "Solicitantes",
  Department: "Departamentos",
  DemandType: "Tipos de Demanda",
  Demand: "Demandas",
  Tag: "Tags",
  DemandTag: "Tags de Demanda",
  Comment: "Comentários",
  Attachment: "Anexos",
  Notification: "Notificações",
  SoapLog: "Logs SOAP",
  SoapTemplate: "Templates SOAP",
  SoapFavorite: "Favoritos SOAP",
  AuditLog: "Logs de Auditoria",
};

export interface BlockingReference {
  model: string;
  label: string;
  field: string;
  count: number;
}

type ReferencingField = {
  modelName: string;
  delegateName: string;
  fkField: string;
  hasDeletedAt: boolean;
};

const referencingFieldsCache = new Map<string, ReferencingField[]>();

/**
 * Walks the Prisma DMMF (generated from schema.prisma) to find every model
 * with a foreign key pointing at `targetModelName` — no manual relation map
 * to keep in sync as the schema grows.
 */
function findReferencingFields(targetModelName: string): ReferencingField[] {
  const cached = referencingFieldsCache.get(targetModelName);
  if (cached) return cached;

  const refs: ReferencingField[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (field.kind !== "object" || field.type !== targetModelName) continue;
      if (!field.relationFromFields?.length) continue;

      refs.push({
        modelName: model.name,
        delegateName: model.name.charAt(0).toLowerCase() + model.name.slice(1),
        fkField: field.relationFromFields[0],
        hasDeletedAt: model.fields.some((f) => f.name === "deletedAt"),
      });
    }
  }

  referencingFieldsCache.set(targetModelName, refs);
  return refs;
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

export function formatBlockingReferences(refs: BlockingReference[]): string {
  return refs.map((r) => `${r.label} (${r.count})`).join(", ");
}
