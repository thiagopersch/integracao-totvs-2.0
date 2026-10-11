import { z } from "zod";

/**
 * Custom ("complementary") fields for Projects/Tasks, defined from the UI (CustomFieldDefinition)
 * and stored as Json on the entity, keyed by definition id. Client-safe: no Prisma/server imports —
 * the same schema builder validates the form (zodResolver) and the server action.
 */

export const CUSTOM_FIELD_ENTITIES = ["PROJECT", "TASK"] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "DATE",
  "SELECT",
  "MULTISELECT",
  "BOOLEAN",
  "USER",
  "URL",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  PROJECT: "Projeto",
  TASK: "Tarefa",
};

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Texto curto",
  LONG_TEXT: "Texto longo",
  NUMBER: "Número",
  CURRENCY: "Moeda (R$)",
  DATE: "Data",
  SELECT: "Seleção única",
  MULTISELECT: "Seleção múltipla",
  BOOLEAN: "Sim/Não",
  USER: "Usuário",
  URL: "Link (URL)",
};

/** Types whose values are option ids from `options`. */
export const OPTION_FIELD_TYPES: readonly CustomFieldType[] = ["SELECT", "MULTISELECT"];

export type CustomFieldOption = { id: string; label: string; color?: string | null };

export type CustomFieldDef = {
  id: string;
  entity: CustomFieldEntity;
  label: string;
  type: CustomFieldType;
  helpText?: string | null;
  required: boolean;
  options: CustomFieldOption[] | null;
  position: number;
  showInList: boolean;
  status: boolean;
};

export type CustomFieldValue = string | number | boolean | string[] | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Narrows the Prisma `options` Json column to a typed option list. */
export function parseOptions(raw: unknown): CustomFieldOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .filter((o) => typeof o.id === "string" && typeof o.label === "string")
    .map((o) => ({ id: o.id as string, label: o.label as string, color: typeof o.color === "string" ? o.color : null }));
}

/** Narrows an entity's `customFields` Json column to a plain record. */
export function parseCustomFieldValues(raw: unknown): CustomFieldValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CustomFieldValues;
}

export function isEmptyCustomFieldValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "number" && Number.isNaN(value))
  );
}

function valueSchema(def: Pick<CustomFieldDef, "type" | "options">): z.ZodType<Exclude<CustomFieldValue, null>> {
  const optionIds = (def.options ?? []).map((o) => o.id);
  const isOption = (v: string) => optionIds.includes(v);
  switch (def.type) {
    case "TEXT":
      return z.string().trim().max(500, "Máximo de 500 caracteres");
    case "LONG_TEXT":
      return z.string().trim().max(10000, "Máximo de 10.000 caracteres");
    case "URL":
      return z.string().trim().url("URL inválida").max(2000);
    case "NUMBER":
    case "CURRENCY":
      return z.coerce.number({ error: "Número inválido" }).refine(Number.isFinite, "Número inválido");
    case "DATE":
      return z.string().regex(DATE_PATTERN, "Data inválida");
    case "SELECT":
      return z.string().refine(isOption, "Opção inválida");
    case "MULTISELECT":
      return z.array(z.string().refine(isOption, "Opção inválida"));
    case "BOOLEAN":
      return z.boolean();
    case "USER":
      return z.string().min(1);
  }
}

/**
 * Zod schema for an entity's custom field values, built from the active definitions. Unknown keys
 * are stripped; empty values become null. `partial` skips the required check (e.g. a kanban quick
 * create that has no custom fields section).
 */
export function buildCustomFieldsSchema(
  defs: Pick<CustomFieldDef, "id" | "type" | "options" | "required">[],
  options: { partial?: boolean } = {},
) {
  const shape: Record<string, z.ZodType<CustomFieldValue>> = {};
  for (const def of defs) {
    const field = z.preprocess(
      (v) => (isEmptyCustomFieldValue(v) ? null : v),
      valueSchema(def).nullable(),
    );
    shape[def.id] =
      def.required && !options.partial ? field.refine((v) => v !== null, "Campo obrigatório") : field;
  }
  return z.object(shape);
}

/**
 * Applies validated incoming values over the stored ones: active definitions are replaced (null
 * removes the key), values of inactive/deleted definitions are kept untouched so reactivating a
 * field brings its data back.
 */
export function mergeCustomFieldValues(
  existing: CustomFieldValues,
  incoming: CustomFieldValues,
  activeDefIds: string[],
): CustomFieldValues {
  const result: CustomFieldValues = { ...existing };
  for (const id of activeDefIds) {
    if (!(id in incoming)) continue;
    const value = incoming[id];
    if (isEmptyCustomFieldValue(value)) delete result[id];
    else result[id] = value;
  }
  return result;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Plain-text rendering of a value (tables, exports, tooltips). */
export function formatCustomFieldValue(
  def: Pick<CustomFieldDef, "type" | "options">,
  value: CustomFieldValue | undefined,
  usersById?: Record<string, string>,
): string {
  if (isEmptyCustomFieldValue(value)) return "";
  const options = def.options ?? [];
  switch (def.type) {
    case "NUMBER":
      return Number(value).toLocaleString("pt-BR");
    case "CURRENCY":
      return currency.format(Number(value));
    case "DATE": {
      const [y, m, d] = String(value).split("-");
      return `${d}/${m}/${y}`;
    }
    case "SELECT":
      return options.find((o) => o.id === value)?.label ?? "";
    case "MULTISELECT":
      return (Array.isArray(value) ? value : [])
        .map((id) => options.find((o) => o.id === id)?.label)
        .filter(Boolean)
        .join(", ");
    case "BOOLEAN":
      return value ? "Sim" : "Não";
    case "USER":
      return usersById?.[String(value)] ?? "";
    default:
      return String(value);
  }
}

/** Comparable key for in-memory sorting by a custom field (`sort=cf_<id>:asc`). */
export function customFieldSortKey(
  def: Pick<CustomFieldDef, "type" | "options">,
  value: CustomFieldValue | undefined,
  usersById?: Record<string, string>,
): string | number {
  if (isEmptyCustomFieldValue(value)) return "";
  if (def.type === "NUMBER" || def.type === "CURRENCY") return Number(value);
  if (def.type === "DATE") return String(value);
  return formatCustomFieldValue(def, value, usersById).toLocaleLowerCase("pt-BR");
}

export const CUSTOM_FIELD_PARAM_PREFIX = "cf_";

/**
 * Prisma `where` clauses for `cf_<defId>=value` URL filters, AND-ed by the caller. Unknown ids and
 * empty values are ignored. Filters run over the Json column (`path` + equals/contains).
 */
export function buildCustomFieldWhere(
  defs: Pick<CustomFieldDef, "id" | "type">[],
  filters: Record<string, string | undefined>,
): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];
  for (const def of defs) {
    const raw = filters[`${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`];
    if (raw === undefined || raw === "") continue;
    const path = [def.id];
    switch (def.type) {
      case "TEXT":
      case "LONG_TEXT":
      case "URL":
        clauses.push({ customFields: { path, string_contains: raw } });
        break;
      case "NUMBER":
      case "CURRENCY": {
        const n = Number(raw);
        if (Number.isFinite(n)) clauses.push({ customFields: { path, equals: n } });
        break;
      }
      case "BOOLEAN":
        if (raw === "true" || raw === "false") clauses.push({ customFields: { path, equals: raw === "true" } });
        break;
      case "MULTISELECT":
        clauses.push({ customFields: { path, array_contains: [raw] } });
        break;
      default:
        clauses.push({ customFields: { path, equals: raw } });
    }
  }
  return clauses;
}
