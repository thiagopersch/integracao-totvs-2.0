import { AI_ENTITIES } from "./definitions";
import { isRef, type AiCatalogs, type AiEntityDef, type AiEntityKey, type AiRecordProposal } from "./types";

export * from "./types";
export { AI_ENTITIES, parseOptionLabels } from "./definitions";

/** Stand-in id for a "@tempId" reference while running the schema (the real id only exists after creation). */
const PENDING_REF = "__pending-ref__";

export interface ValidateContext {
  catalogs: AiCatalogs;
  /** The other proposals of the batch, for "@tempId" references. */
  batch: Pick<AiRecordProposal, "tempId" | "entity">[];
  /** Non-privileged users only launch demands for their own analyst. */
  analystScope?: string | null;
}

/** Same rules as the entity's create action (its zod schema), plus reference and analyst-scope checks. */
export function validateRecord(entity: AiEntityKey, values: Record<string, string>, ctx: ValidateContext): Record<string, string> {
  const def = AI_ENTITIES[entity];
  const errors: Record<string, string> = {};
  const resolved = { ...values };

  for (const field of def.fields) {
    const value = values[field.key] ?? "";
    if (field.required && !value) errors[field.key] = `${field.label} é obrigatório`;
    if (field.kind !== "ref" || !value || !field.ref) continue;

    if (isRef(value)) {
      const target = ctx.batch.find((r) => r.tempId === value.slice(1));
      if (!target || AI_ENTITIES[target.entity].catalog !== field.ref) errors[field.key] = `${field.label}: referência inválida`;
      resolved[field.key] = PENDING_REF;
      continue;
    }
    const items = ctx.catalogs[field.ref];
    const item = items?.find((i) => i.id === value);
    if (items && !item) {
      errors[field.key] = `${field.label} não encontrado`;
      continue;
    }
    // A contract must be of the chosen client, a stage of the chosen project...
    const parentValue = field.parentField ? values[field.parentField] : "";
    if (item && parentValue && !isRef(parentValue) && item.parentId && item.parentId !== parentValue) {
      errors[field.key] = `${field.label} não pertence ao ${def.fields.find((f) => f.key === field.parentField)?.label.toLowerCase()} escolhido`;
    }
    if (item && parentValue && isRef(parentValue)) errors[field.key] = `${field.label} não pertence ao registro novo escolhido`;
  }

  const parsed = def.schema.safeParse(def.toInput(resolved));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      // Fields the card doesn't show (stages, settings...) are reported on the card itself.
      errors[def.fields.some((f) => f.key === key) ? key : "_form"] ??= issue.message;
    }
  }
  if (entity === "demand" && ctx.analystScope && values.analystId && values.analystId !== ctx.analystScope) {
    errors.analystId = "Você só pode lançar demandas para si mesmo";
  }
  return errors;
}

/** Fields of `def` that reference another proposal of the batch. */
export function pendingRefs(def: AiEntityDef, values: Record<string, string>): string[] {
  return def.fields.filter((f) => f.kind === "ref" && isRef(values[f.key] ?? "")).map((f) => values[f.key].slice(1));
}

/** Replaces "@tempId" values by the ids of records already created. */
export function resolveRefs(entity: AiEntityKey, values: Record<string, string>, createdIds: Record<string, string>) {
  const next = { ...values };
  for (const field of AI_ENTITIES[entity].fields) {
    const value = next[field.key] ?? "";
    if (field.kind === "ref" && isRef(value) && createdIds[value.slice(1)]) next[field.key] = createdIds[value.slice(1)];
  }
  return next;
}

/** Creation order where every record comes after the ones it references (unknown refs and cycles keep their order). */
export function orderForCreation<T extends Pick<AiRecordProposal, "tempId" | "entity" | "values">>(records: T[]): T[] {
  const byId = new Map(records.map((r) => [r.tempId, r]));
  const done = new Set<string>();
  const visiting = new Set<string>();
  const result: T[] = [];
  const visit = (r: T) => {
    if (done.has(r.tempId) || visiting.has(r.tempId)) return;
    visiting.add(r.tempId);
    for (const dep of pendingRefs(AI_ENTITIES[r.entity], r.values)) {
      const target = byId.get(dep);
      if (target) visit(target);
    }
    visiting.delete(r.tempId);
    done.add(r.tempId);
    result.push(r);
  };
  records.forEach(visit);
  return result;
}

/** Card title: the entity's title field, falling back to its label. */
export function recordTitle(entity: AiEntityKey, values: Record<string, string>) {
  const def = AI_ENTITIES[entity];
  const title = values[def.titleField];
  if (!title) return `${def.label} sem nome`;
  return entity === "contract" ? `${title} h/mês` : title;
}
