import { prisma } from "@/lib/prisma";
import { Prisma, type CustomFieldDefinition } from "@/generated/prisma/client";
import { BaseRepository } from "@/repositories/base.repository";
import {
  buildCustomFieldsSchema,
  mergeCustomFieldValues,
  parseCustomFieldValues,
  parseConfig,
  parseOptions,
  type CustomFieldDef,
  type CustomFieldEntity,
  type CustomFieldValues,
} from "@/lib/custom-fields";
import type { CustomFieldDefinitionInput } from "@/schemas/custom-field.schema";
import type { ListParams } from "@/types/common";

class CustomFieldDefinitionRepository extends BaseRepository<CustomFieldDefinition> {
  constructor() {
    super(prisma.customFieldDefinition, ["label"], "custom_field_definitions", "CustomFieldDefinition");
  }

  protected defaultOrderBy() {
    return [{ entity: "asc" as const }, { position: "asc" as const }];
  }
}

export const customFieldDefinitionRepository = new CustomFieldDefinitionRepository();

const ENTITY_TABLES: Record<CustomFieldEntity, string> = { PROJECT: "projects", TASK: "project_tasks" };

export function toCustomFieldDef(row: CustomFieldDefinition): CustomFieldDef {
  return {
    id: row.id,
    entity: row.entity,
    label: row.label,
    type: row.type,
    helpText: row.helpText,
    required: row.required,
    options: parseOptions(row.options),
    config: parseConfig(row.config),
    position: row.position,
    showInList: row.showInList,
    status: row.status,
  };
}

async function countRaw(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(query);
  return Number(rows[0]?.count ?? 0);
}

export const customFieldService = {
  async list(params: ListParams, organizationId: string) {
    const { data, meta } = await customFieldDefinitionRepository.findAll(params, organizationId);
    const usage = await Promise.all(data.map((row) => this.countUsage(row.id, row.entity, organizationId)));
    return {
      data: data.map((row, i) => ({ ...toCustomFieldDef(row), usageCount: usage[i], createdAt: row.createdAt })),
      meta,
    };
  },

  async listActive(organizationId: string, entity: CustomFieldEntity): Promise<CustomFieldDef[]> {
    const rows = await prisma.customFieldDefinition.findMany({
      where: { organizationId, entity, status: true, deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toCustomFieldDef);
  },

  /** Live rows of the entity that hold a value for this definition. */
  async countUsage(id: string, entity: CustomFieldEntity, organizationId: string): Promise<number> {
    const table = Prisma.raw(`"${ENTITY_TABLES[entity]}"`);
    return countRaw(
      Prisma.sql`SELECT count(*)::bigint AS count FROM ${table}
        WHERE deleted_at IS NULL AND organization_id = ${organizationId} AND jsonb_exists(custom_fields, ${id})`,
    );
  },

  /** Live rows whose value (single or multi select) references the option. */
  async countOptionUsage(id: string, entity: CustomFieldEntity, optionId: string, organizationId: string): Promise<number> {
    const table = Prisma.raw(`"${ENTITY_TABLES[entity]}"`);
    return countRaw(
      Prisma.sql`SELECT count(*)::bigint AS count FROM ${table}
        WHERE deleted_at IS NULL AND organization_id = ${organizationId}
          AND (custom_fields -> ${id}) @> to_jsonb(${optionId}::text)`,
    );
  },

  async getById(id: string, organizationId: string) {
    return customFieldDefinitionRepository.findById(id, organizationId);
  },

  async create(input: CustomFieldDefinitionInput, organizationId: string) {
    const last = await prisma.customFieldDefinition.aggregate({
      where: { organizationId, entity: input.entity, deletedAt: null },
      _max: { position: true },
    });
    return prisma.customFieldDefinition.create({
      data: {
        organizationId,
        entity: input.entity,
        label: input.label,
        type: input.type,
        helpText: input.helpText || null,
        required: input.required,
        showInList: input.showInList,
        status: input.status,
        options: input.options as Prisma.InputJsonValue,
        config: input.config as Prisma.InputJsonValue,
        position: (last._max.position ?? -1) + 1,
      },
    });
  },

  async update(id: string, input: CustomFieldDefinitionInput, organizationId: string) {
    const existing = await customFieldDefinitionRepository.findById(id, organizationId);
    if (!existing) throw new Error("Campo não encontrado");

    if (existing.type !== input.type || existing.entity !== input.entity) {
      const usage = await this.countUsage(id, existing.entity, organizationId);
      if (usage > 0) {
        throw new Error(`Não é possível alterar o tipo ou a entidade: o campo já tem valor em ${usage} registro(s).`);
      }
    }

    const nextOptionIds = new Set(input.options.map((o) => o.id));
    const removed = parseOptions(existing.options).filter((o) => !nextOptionIds.has(o.id));
    if (existing.type === input.type) {
      for (const option of removed) {
        const usage = await this.countOptionUsage(id, existing.entity, option.id, organizationId);
        if (usage > 0) throw new Error(`Não é possível remover a opção "${option.label}": em uso em ${usage} registro(s).`);
      }
    }

    return prisma.customFieldDefinition.update({
      where: { id, organizationId },
      data: {
        entity: input.entity,
        label: input.label,
        type: input.type,
        helpText: input.helpText || null,
        required: input.required,
        showInList: input.showInList,
        status: input.status,
        options: input.options as Prisma.InputJsonValue,
        config: input.config as Prisma.InputJsonValue,
      },
    });
  },

  async assertNotInUse(id: string, organizationId: string, verb: string) {
    const existing = await customFieldDefinitionRepository.findById(id, organizationId);
    if (!existing) throw new Error("Campo não encontrado");
    const usage = await this.countUsage(id, existing.entity, organizationId);
    if (usage > 0) {
      throw new Error(`Não é possível ${verb}: o campo tem valor em ${usage} registro(s). Desative o campo para ocultá-lo.`);
    }
    return existing;
  },

  async softDelete(id: string, organizationId: string) {
    await this.assertNotInUse(id, organizationId, "excluir");
    return customFieldDefinitionRepository.softDelete(id, organizationId);
  },

  /** Deactivating hides the field from forms/columns but keeps its stored values. */
  async setStatus(id: string, status: boolean, organizationId: string) {
    return customFieldDefinitionRepository.setStatus(id, status, organizationId);
  },

  async restore(id: string, organizationId: string) {
    return customFieldDefinitionRepository.restore(id, organizationId);
  },

  async bulkSoftDelete(ids: string[], organizationId: string) {
    const inUse: { id: string; reasons: { model: string; label: string; field: string; count: number }[] }[] = [];
    const free: string[] = [];
    for (const id of ids) {
      const row = await customFieldDefinitionRepository.findById(id, organizationId);
      if (!row) continue;
      const usage = await this.countUsage(id, row.entity, organizationId);
      if (usage > 0) {
        inUse.push({
          id,
          reasons: [{ model: row.entity === "PROJECT" ? "Project" : "ProjectTask", label: row.entity === "PROJECT" ? "Projetos" : "Tarefas de Projeto", field: "customFields", count: usage }],
        });
      } else free.push(id);
    }
    const result = await customFieldDefinitionRepository.bulkSoftDelete(free, organizationId);
    return { ...result, blocked: [...inUse, ...result.blocked] };
  },

  async bulkRestore(ids: string[], organizationId: string) {
    return customFieldDefinitionRepository.bulkRestore(ids, organizationId);
  },

  async reorder(entity: CustomFieldEntity, ids: string[], organizationId: string) {
    await prisma.$transaction(
      ids.map((id, position) =>
        prisma.customFieldDefinition.updateMany({ where: { id, organizationId, entity }, data: { position } }),
      ),
    );
  },

  /**
   * Server-side validation of submitted values against the ACTIVE definitions, merged over the
   * stored values (inactive fields keep their data). USER values must be active users of the org.
   * Throws a pt-BR message naming the first invalid field.
   */
  async validateValues(
    organizationId: string,
    entity: CustomFieldEntity,
    raw: unknown,
    existing?: unknown,
    options: { partial?: boolean } = {},
  ): Promise<CustomFieldValues> {
    const defs = await this.listActive(organizationId, entity);
    const incoming = parseCustomFieldValues(raw);
    const schema = buildCustomFieldsSchema(defs, options);
    const parsed = schema.safeParse(incoming);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const label = defs.find((d) => d.id === issue.path[0])?.label ?? "Propriedade";
      throw new Error(`${label}: ${issue.message}`);
    }

    // With `partial`, only keys actually submitted are applied.
    const values = options.partial
      ? Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in incoming))
      : parsed.data;

    const userIds = defs
      .filter((d) => d.type === "USER" && typeof values[d.id] === "string")
      .map((d) => values[d.id] as string);
    if (userIds.length) {
      const found = await prisma.user.count({ where: { id: { in: userIds }, organizationId, deletedAt: null, status: true } });
      if (found !== new Set(userIds).size) throw new Error("Usuário inválido em campo personalizado");
    }

    return mergeCustomFieldValues(
      parseCustomFieldValues(existing),
      values as CustomFieldValues,
      defs.map((d) => d.id),
    );
  },
};
