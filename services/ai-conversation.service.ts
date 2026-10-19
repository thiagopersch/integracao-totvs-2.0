import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Conversations listed in the history panel (most recent first). */
const LIST_LIMIT = 50;

interface Owner {
  organizationId: string;
  userId: string;
}

export const aiConversationService = {
  list(owner: Owner, search?: string) {
    const term = search?.trim();
    return prisma.aiConversation.findMany({
      where: {
        ...owner,
        ...(term
          ? {
              OR: [
                { title: { contains: term, mode: "insensitive" } },
                { searchText: { contains: term, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    });
  },

  getById(id: string, owner: Owner) {
    return prisma.aiConversation.findFirst({ where: { id, ...owner }, select: { id: true, title: true, state: true } });
  },

  /** Creates the conversation, or updates it when `id` is one of the user's own. */
  async save(owner: Owner, input: { id?: string; title: string; searchText: string; state: Prisma.InputJsonValue }) {
    const data = { title: input.title, searchText: input.searchText, state: input.state };
    if (input.id) {
      const { count } = await prisma.aiConversation.updateMany({ where: { id: input.id, ...owner }, data });
      if (count) return input.id;
    }
    const created = await prisma.aiConversation.create({ data: { ...owner, ...data }, select: { id: true } });
    return created.id;
  },

  async delete(id: string, owner: Owner) {
    await prisma.aiConversation.deleteMany({ where: { id, ...owner } });
  },
};
