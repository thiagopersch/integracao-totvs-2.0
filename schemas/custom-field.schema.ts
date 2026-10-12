import { z } from "zod";
import {
  CONFIG_KEYS_BY_TYPE,
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  OPTION_FIELD_TYPES,
  type CustomFieldConfig,
} from "@/lib/custom-fields";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Option label is only checked (non-empty/unique) for option types — see superRefine below. */
export const customFieldOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().max(100, "Máximo de 100 caracteres"),
  color: z.string().regex(HEX_COLOR, "Cor inválida").nullable().optional(),
});

const optionalNumber = z.number().finite().nullable().optional();
const optionalCount = z.number().int("Informe um número inteiro").min(0, "Valor inválido").nullable().optional();

export const customFieldConfigSchema = z.object({
  placeholder: z.string().trim().max(120).optional(),
  minLength: optionalCount,
  maxLength: optionalCount,
  min: optionalNumber,
  max: optionalNumber,
  integer: z.boolean().optional(),
  minDate: z.string().regex(DATE_PATTERN).or(z.literal("")).optional(),
  maxDate: z.string().regex(DATE_PATTERN).or(z.literal("")).optional(),
  minTime: z.string().regex(TIME_PATTERN).or(z.literal("")).optional(),
  maxTime: z.string().regex(TIME_PATTERN).or(z.literal("")).optional(),
  minSelected: optionalCount,
  maxSelected: optionalCount,
});

/** Keeps only the rules that apply to `type`, dropping empty values. */
function pickConfig(type: (typeof CUSTOM_FIELD_TYPES)[number], config: z.output<typeof customFieldConfigSchema>): CustomFieldConfig {
  const result: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS_BY_TYPE[type]) {
    const value = config[key];
    if (value === null || value === undefined || value === "" || value === false) continue;
    result[key] = value;
  }
  return result as CustomFieldConfig;
}

const RANGES: [keyof CustomFieldConfig, keyof CustomFieldConfig, string][] = [
  ["minLength", "maxLength", "O mínimo de caracteres não pode ser maior que o máximo"],
  ["min", "max", "O valor mínimo não pode ser maior que o máximo"],
  ["minDate", "maxDate", "A data mínima não pode ser posterior à máxima"],
  ["minTime", "maxTime", "A hora mínima não pode ser posterior à máxima"],
  ["minSelected", "maxSelected", "O mínimo de seleções não pode ser maior que o máximo"],
];

export const customFieldDefinitionSchema = z
  .object({
    entity: z.enum(CUSTOM_FIELD_ENTITIES),
    label: z.string().trim().min(1, "Nome é obrigatório").max(80, "Nome deve ter no máximo 80 caracteres"),
    type: z.enum(CUSTOM_FIELD_TYPES),
    helpText: z.string().trim().max(300, "Máximo de 300 caracteres").optional(),
    required: z.boolean().default(false),
    showInList: z.boolean().default(false),
    status: z.boolean().default(true),
    options: z.array(customFieldOptionSchema).default([]),
    config: customFieldConfigSchema.default({}),
  })
  .superRefine((value, ctx) => {
    const config = pickConfig(value.type, value.config);
    for (const [minKey, maxKey, message] of RANGES) {
      const min = config[minKey];
      const max = config[maxKey];
      if (min !== undefined && max !== undefined && min > max) ctx.addIssue({ code: "custom", path: ["config", maxKey], message });
    }
    // Options only matter for option types — other types ignore (and drop) leftover options, so
    // switching the type after adding options never blocks saving.
    if (!OPTION_FIELD_TYPES.includes(value.type)) return;
    if (value.options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Adicione ao menos uma opção" });
      return;
    }
    if (value.options.some((o) => !o.label)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Informe o nome de todas as opções" });
      return;
    }
    const seen = new Set<string>();
    for (const option of value.options) {
      const key = option.label.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["options"], message: `Opção "${option.label}" repetida` });
        break;
      }
      seen.add(key);
    }
  })
  .transform((value) => ({
    ...value,
    options: OPTION_FIELD_TYPES.includes(value.type) ? value.options : [],
    config: pickConfig(value.type, value.config),
  }));

export const reorderCustomFieldsSchema = z.object({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  ids: z.array(z.string().min(1)).min(1),
});

export type CustomFieldDefinitionInput = z.output<typeof customFieldDefinitionSchema>;
export type CustomFieldDefinitionFormValues = z.input<typeof customFieldDefinitionSchema>;
