import { prisma } from "@/lib/prisma";
import { assertClientAllowed } from "@/lib/client-access";
import { demandIncludeRelations } from "@/services/demand.service";

const DEMAND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const exportService = {
  /** Every non-deleted client the requesting user is allowed to see, regardless of active/inactive
   *  status or whether it currently has a valid contract — the export's real data filter is the
   *  chosen period, applied separately to the demands themselves. */
  async getExportableClients(organizationId: string, allowedClientIds: string[]) {
    return prisma.client.findMany({
      where: {
        deletedAt: null,
        organizationId,
        id: { in: allowedClientIds },
      },
      orderBy: { name: "asc" },
    });
  },

  /**
   * `clientIds` containing "all" (or empty) never means literally every client in the DB — it
   * resolves to `allowedClientIds`, so exports can never surface a client outside the requesting
   * user's scope.
   */
  async getEffectiveClientIds(organizationId: string, allowedClientIds: string[], clientIds: string[]) {
    if (clientIds.length === 0 || clientIds.includes("all")) {
      const clients = await this.getExportableClients(organizationId, allowedClientIds);
      return clients.map((c) => c.id);
    }
    clientIds.forEach((id) => assertClientAllowed(id, allowedClientIds));
    return clientIds;
  },

  async getExportDemands(
    organizationId: string,
    allowedClientIds: string[],
    analystScope: string | undefined,
    clientIds: string[],
    period?: { gte: Date; lt: Date }
  ) {
    const effectiveClientIds = await this.getEffectiveClientIds(organizationId, allowedClientIds, clientIds);
    const where = {
      deletedAt: null,
      organizationId,
      clientId: { in: effectiveClientIds },
      ...(analystScope ? { analystId: analystScope } : {}),
      ...(period ? { date: period } : {}),
    };
    const demands = await prisma.demand.findMany({ where, orderBy: { date: "asc" as const }, include: demandIncludeRelations });
    return { demands, effectiveClientIds };
  },

  async getExportChartData(organizationId: string, effectiveClientIds: string[], period?: { gte: Date; lt: Date }) {
    const where = {
      deletedAt: null,
      organizationId,
      clientId: { in: effectiveClientIds },
      ...(period ? { date: period } : {}),
    };

    const [statusRaw, analystRaw, clientRaw, contractsRaw, minutesRaw] = await Promise.all([
      prisma.demand.groupBy({ by: ["status"], where, _count: { id: true } }),
      prisma.demand.groupBy({ by: ["analystId"], where, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 8 }),
      effectiveClientIds.length > 1
        ? prisma.demand.groupBy({ by: ["clientId"], where, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 8 })
        : Promise.resolve([]),
      prisma.clientContract.groupBy({
        by: ["clientId"],
        where: { status: "ACTIVE", clientId: { in: effectiveClientIds } },
        _sum: { contractedHours: true },
      }),
      prisma.demand.groupBy({ by: ["clientId"], where, _sum: { durationMinutes: true } }),
    ]);

    const demandsByStatus = statusRaw.map((d) => ({ name: DEMAND_STATUS_LABELS[d.status] || d.status, value: d._count.id }));

    const analystIds = analystRaw.map((d) => d.analystId);
    const analysts = analystIds.length
      ? await prisma.analyst.findMany({ where: { id: { in: analystIds } }, select: { id: true, name: true } })
      : [];
    const analystNameById = new Map(analysts.map((a) => [a.id, a.name]));
    const demandsByAnalyst = analystRaw.map((d) => ({ name: analystNameById.get(d.analystId) || "Desconhecido", value: d._count.id }));

    const clientIds = clientRaw.map((d) => d.clientId);
    const clients = clientIds.length
      ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
      : [];
    const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
    const demandsByClient = clientRaw.map((d) => ({ name: clientNameById.get(d.clientId) || "Desconhecido", value: d._count.id }));

    const contractedByClientId = new Map(contractsRaw.map((c) => [c.clientId, c._sum.contractedHours || 0]));
    const spentByClientId = new Map(minutesRaw.map((d) => [d.clientId, d._sum.durationMinutes || 0]));
    const rankingClientIds = Array.from(new Set([...contractedByClientId.keys(), ...spentByClientId.keys()]));
    const rankingClients = rankingClientIds.length
      ? await prisma.client.findMany({ where: { id: { in: rankingClientIds } }, select: { id: true, name: true } })
      : [];
    const rankingNameById = new Map(rankingClients.map((c) => [c.id, c.name]));
    const clientHoursRanking = rankingClientIds
      .map((id) => ({
        name: rankingNameById.get(id) || "Desconhecido",
        contratadas: Math.round((contractedByClientId.get(id) || 0) * 100) / 100,
        gastas: Math.round(((spentByClientId.get(id) || 0) / 60) * 100) / 100,
      }))
      .sort((a, b) => b.gastas - a.gastas);

    return { demandsByStatus, demandsByAnalyst, demandsByClient, clientHoursRanking };
  },
};
