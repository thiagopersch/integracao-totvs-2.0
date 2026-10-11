import { z } from "zod";
import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, OPTION_FIELD_TYPES } from "@/lib/custom-fields";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const customFieldOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Informe o nome da opção").max(100, "Máximo de 100 caracteres"),
  color: z.string().regex(HEX_COLOR, "Cor inválida").nullable().optional(),
});

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
  })
  .superRefine((value, ctx) => {
    if (!OPTION_FIELD_TYPES.includes(value.type)) return;
    if (value.options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Adicione ao menos uma opção" });
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
  });

export const reorderCustomFieldsSchema = z.object({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  ids: z.array(z.string().min(1)).min(1),
});

export type CustomFieldDefinitionInput = z.output<typeof customFieldDefinitionSchema>;
export type CustomFieldDefinitionFormValues = z.input<typeof customFieldDefinitionSchema>;
