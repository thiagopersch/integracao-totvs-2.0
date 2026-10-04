import { prisma } from "@/lib/prisma";
import { findBlockingReferences, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations";
import { renderBlockTree } from "@/lib/message-templates/render-email";
import type { BlockTree } from "@/lib/message-templates/block-types";
import type { MessageChannel, MessageTemplateEvent, Prisma } from "@/generated/prisma/client";
import type { MessageTemplateInput } from "@/schemas/message-template.schema";
import type { ListParams } from "@/types/common";
import type { BulkDeleteResult } from "@/repositories/base.repository";
import { safeOrderBy } from "@/lib/sort";

const SORTABLE_FIELDS = new Set(["name", "channel", "event", "isActive", "updatedAt", "createdAt"]);

/** Only the fields of the template's own channel are kept (an email template has no bodyText, etc.). */
function toData(input: MessageTemplateInput) {
  const isEmail = input.channel === "EMAIL";
  return {
    name: input.name,
    channel: input.channel,
    event: input.event,
    isActive: input.isActive,
    subject: isEmail ? input.subject : "",
    content: isEmail ? (input.content as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
    bodyHtml: isEmail ? renderBlockTree(input.content as BlockTree) : "",
    bodyText: isEmail ? "" : input.bodyText,
  };
}

export const messageTemplateService = {
  async list(params: ListParams, organizationId: string) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const filters = params.filters ?? {};
    const where: Prisma.MessageTemplateWhereInput = {
      organizationId,
      deletedAt: null,
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
      ...(filters.channel ? { channel: filters.channel as MessageChannel } : {}),
      ...(filters.event ? { event: filters.event as MessageTemplateEvent } : {}),
      ...(filters.status ? { isActive: filters.status === "active" } : {}),
    };
    const orderBy =
      params.sort && SORTABLE_FIELDS.has(params.sort.field)
        ? safeOrderBy(params.sort)
        : { updatedAt: "desc" as const };

    const [data, total] = await Promise.all([
      prisma.messageTemplate.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, channel: true, event: true, subject: true, isActive: true, updatedAt: true },
      }),
      prisma.messageTemplate.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async getById(id: string, organizationId: string) {
    return prisma.messageTemplate.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  /** Newest active template for an (event, channel) pair — the one used when sending. */
  async findActive(organizationId: string, event: MessageTemplateEvent, channel: MessageChannel) {
    return prisma.messageTemplate.findFirst({
      where: { organizationId, event, channel, isActive: true, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  },

  async create(input: MessageTemplateInput, organizationId: string) {
    return prisma.messageTemplate.create({ data: { ...toData(input), organizationId } });
  },

  async update(id: string, input: MessageTemplateInput, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) throw new Error("Template não encontrado");
    return prisma.messageTemplate.update({ where: { id }, data: toData(input) });
  },

  async setActive(id: string, isActive: boolean, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) throw new Error("Template não encontrado");
    return prisma.messageTemplate.update({ where: { id }, data: { isActive } });
  },

  async duplicate(id: string, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) throw new Error("Template não encontrado");
    return prisma.messageTemplate.create({
      data: {
        organizationId,
        name: `${existing.name} (cópia)`.slice(0, 120),
        event: existing.event,
        channel: existing.channel,
        subject: existing.subject,
        content: (existing.content ?? []) as Prisma.InputJsonValue,
        bodyHtml: existing.bodyHtml,
        bodyText: existing.bodyText,
        // A copy starts inactive so it never silently replaces the template in use.
        isActive: false,
      },
    });
  },

  async remove(id: string, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) throw new Error("Template não encontrado");
    const reasons = await findBlockingReferences("MessageTemplate", id);
    if (reasons.length > 0) {
      throw new Error(`Não é possível excluir: registro em uso em ${formatBlockingReferences(reasons)}.`);
    }
    await prisma.messageTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async bulkDelete(ids: string[], organizationId: string): Promise<BulkDeleteResult> {
    const owned = await prisma.messageTemplate.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null },
      select: { id: true },
    });
    const blocked: { id: string; reasons: BlockingReference[] }[] = [];
    const deletableIds: string[] = [];
    for (const template of owned) {
      const reasons = await findBlockingReferences("MessageTemplate", template.id);
      if (reasons.length > 0) blocked.push({ id: template.id, reasons });
      else deletableIds.push(template.id);
    }
    if (deletableIds.length > 0) {
      await prisma.messageTemplate.updateMany({ where: { id: { in: deletableIds } }, data: { deletedAt: new Date() } });
    }
    return { deletedCount: deletableIds.length, deletedIds: deletableIds, blocked };
  },
};
