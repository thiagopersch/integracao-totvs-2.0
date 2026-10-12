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
  "CHECKBOX",
  "CHECKBOX_GROUP",
  "DATETIME",
  "TIME",
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
  CHECKBOX: "Checkbox (único)",
  CHECKBOX_GROUP: "Grupo de checkboxes",
  DATETIME: "Data e hora",
  TIME: "Hora",
};

/** Types whose values are option ids from `options`. */
export const OPTION_FIELD_TYPES: readonly CustomFieldType[] = ["SELECT", "MULTISELECT", "CHECKBOX_GROUP"];

/** Types whose value is a list of option ids. */
export const MULTI_OPTION_TYPES: readonly CustomFieldType[] = ["MULTISELECT", "CHECKBOX_GROUP"];

/**
 * Validation rules configured on the definition (`CustomFieldDefinition.config`). Which keys apply
 * depends on the type — see CONFIG_KEYS_BY_TYPE; the rest are ignored.
 */
export type CustomFieldConfig = {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  /** yyyy-MM-dd */
  minDate?: string;
  maxDate?: string;
  /** HH:mm */
  minTime?: string;
  maxTime?: string;
  minSelected?: number;
  maxSelected?: number;
};

export const CONFIG_KEYS_BY_TYPE: Record<CustomFieldType, (keyof CustomFieldConfig)[]> = {
  TEXT: ["placeholder", "minLength", "maxLength"],
  LONG_TEXT: ["placeholder", "minLength", "maxLength"],
  NUMBER: ["placeholder", "min", "max", "integer"],
  CURRENCY: ["min", "max"],
  DATE: ["minDate", "maxDate"],
  DATETIME: ["minDate", "maxDate"],
  TIME: ["minTime", "maxTime"],
  SELECT: [],
  MULTISELECT: ["minSelected", "maxSelected"],
  CHECKBOX_GROUP: ["minSelected", "maxSelected"],
  BOOLEAN: [],
  CHECKBOX: [],
  USER: [],
  URL: ["placeholder"],
};

export type CustomFieldOption = { id: string; label: string; color?: string | null };

export type CustomFieldDef = {
  id: string;
  entity: CustomFieldEntity;
  label: string;
  type: CustomFieldType;
  helpText?: string | null;
  required: boolean;
  options: CustomFieldOption[] | null;
  config?: CustomFieldConfig | null;
  position: number;
  showInList: boolean;
  status: boolean;
};

export type CustomFieldValue = string | number | boolean | string[] | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const numberValue = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const stringValue = (v: unknown, pattern?: RegExp) => (typeof v === "string" && (!pattern || pattern.test(v)) ? v : undefined);

/** Narrows the Prisma `config` Json column, keeping only well-typed keys. */
export function parseConfig(raw: unknown): CustomFieldConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const v = raw as Record<string, unknown>;
  const config: CustomFieldConfig = {};
  if (typeof v.placeholder === "string" && v.placeholder.trim()) config.placeholder = v.placeholder.trim();
  for (const key of ["minLength", "maxLength", "min", "max", "minSelected", "maxSelected"] as const) {
    const n = numberValue(v[key]);
    if (n !== undefined) config[key] = n;
  }
  if (v.integer === true) config.integer = true;
  for (const key of ["minDate", "maxDate"] as const) {
    const d = stringValue(v[key], DATE_PATTERN);
    if (d) config[key] = d;
  }
  for (const key of ["minTime", "maxTime"] as const) {
    const t = stringValue(v[key], TIME_PATTERN);
    if (t) config[key] = t;
  }
  return config;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatDateKey = (key: string) => key.split("-").reverse().join("/");

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

function valueSchema(def: Pick<CustomFieldDef, "type" | "options" | "config">): z.ZodType<Exclude<CustomFieldValue, null>> {
  const optionIds = (def.options ?? []).map((o) => o.id);
  const isOption = (v: string) => optionIds.includes(v);
  const c = def.config ?? {};
  switch (def.type) {
    case "TEXT":
    case "LONG_TEXT": {
      let schema = z.string().trim().max(def.type === "TEXT" ? 500 : 10000, `Máximo de ${def.type === "TEXT" ? 500 : 10000} caracteres`);
      if (c.minLength) schema = schema.min(c.minLength, `Mínimo de ${c.minLength} caracteres`);
      if (c.maxLength) schema = schema.max(c.maxLength, `Máximo de ${c.maxLength} caracteres`);
      return schema;
    }
    case "URL":
      return z.string().trim().url("URL inválida — use o formato https://…").max(2000);
    case "NUMBER":
    case "CURRENCY": {
      const fmt = (n: number) => (def.type === "CURRENCY" ? brl.format(n) : n.toLocaleString("pt-BR"));
      let schema = z.coerce.number({ error: "Número inválido" }).refine(Number.isFinite, "Número inválido");
      if (c.min !== undefined) schema = schema.refine((n) => n >= c.min!, `Valor mínimo ${fmt(c.min)}`);
      if (c.max !== undefined) schema = schema.refine((n) => n <= c.max!, `Valor máximo ${fmt(c.max)}`);
      if (def.type === "NUMBER" && c.integer) schema = schema.refine(Number.isInteger, "Informe um número inteiro");
      return schema;
    }
    case "DATE":
    case "DATETIME": {
      let schema: z.ZodType<string> = z.string().regex(def.type === "DATE" ? DATE_PATTERN : DATETIME_PATTERN, def.type === "DATE" ? "Data inválida" : "Informe data e hora");
      if (c.minDate) schema = schema.refine((v) => v.slice(0, 10) >= c.minDate!, `Data mínima ${formatDateKey(c.minDate)}`);
      if (c.maxDate) schema = schema.refine((v) => v.slice(0, 10) <= c.maxDate!, `Data máxima ${formatDateKey(c.maxDate)}`);
      return schema;
    }
    case "TIME": {
      let schema: z.ZodType<string> = z.string().regex(TIME_PATTERN, "Hora inválida");
      if (c.minTime) schema = schema.refine((v) => v >= c.minTime!, `Hora mínima ${c.minTime}`);
      if (c.maxTime) schema = schema.refine((v) => v <= c.maxTime!, `Hora máxima ${c.maxTime}`);
      return schema;
    }
    case "SELECT":
      return z.string().refine(isOption, "Opção inválida");
    case "MULTISELECT":
    case "CHECKBOX_GROUP": {
      let schema: z.ZodType<string[]> = z.array(z.string().refine(isOption, "Opção inválida"));
      if (c.minSelected) schema = schema.refine((v) => v.length >= c.minSelected!, `Selecione ao menos ${c.minSelected} opção(ões)`);
      if (c.maxSelected) schema = schema.refine((v) => v.length <= c.maxSelected!, `Selecione no máximo ${c.maxSelected} opção(ões)`);
      return schema;
    }
    case "BOOLEAN":
    case "CHECKBOX":
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
  defs: Pick<CustomFieldDef, "id" | "type" | "options" | "required" | "config">[],
  options: { partial?: boolean } = {},
) {
  const shape: Record<string, z.ZodType<CustomFieldValue>> = {};
  for (const def of defs) {
    const field = z.preprocess(
      (v) => (isEmptyCustomFieldValue(v) ? null : v),
      valueSchema(def).nullable(),
    );
    if (!def.required || options.partial) shape[def.id] = field;
    // A required single checkbox means "must be checked" (e.g. an acceptance term).
    else if (def.type === "CHECKBOX") shape[def.id] = field.refine((v) => v === true, "Marque esta opção para continuar");
    else shape[def.id] = field.refine((v) => v !== null, "Campo obrigatório");
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
      return brl.format(Number(value));
    case "DATE":
      return formatDateKey(String(value));
    case "DATETIME": {
      const [date, time] = String(value).split("T");
      return `${formatDateKey(date)} ${time ?? ""}`.trim();
    }
    case "SELECT":
      return options.find((o) => o.id === value)?.label ?? "";
    case "MULTISELECT":
    case "CHECKBOX_GROUP":
      return (Array.isArray(value) ? value : [])
        .map((id) => options.find((o) => o.id === id)?.label)
        .filter(Boolean)
        .join(", ");
    case "BOOLEAN":
    case "CHECKBOX":
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
  if (def.type === "DATE" || def.type === "DATETIME" || def.type === "TIME") return String(value);
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
      case "CHECKBOX":
        if (raw === "true" || raw === "false") clauses.push({ customFields: { path, equals: raw === "true" } });
        break;
      case "DATETIME":
        clauses.push({ customFields: { path, string_starts_with: raw } });
        break;
      case "MULTISELECT":
      case "CHECKBOX_GROUP":
        clauses.push({ customFields: { path, array_contains: [raw] } });
        break;
      default:
        clauses.push({ customFields: { path, equals: raw } });
    }
  }
  return clauses;
}
