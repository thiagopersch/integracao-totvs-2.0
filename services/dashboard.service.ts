import { prisma } from "@/lib/prisma";

const DEMAND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export const dashboardService = {
  async getStats(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalClients,
      totalTbcs,
      totalUsers,
      todaySoapCalls,
      failedToday,
      avgDurationResult,
      recentLogs,
      clientCount,
      dailyStats,
      activeTbcs,
      inactiveTbcs,
      activeFilters,
      inactiveFilters,
      sentencesByCategoryRaw,
      demandsByStatusRaw,
      demandsByAnalystRaw,
      demandsByClientRaw,
      contractsByClient,
      demandMinutesByClient,
    ] = await Promise.all([
      prisma.client.count({ where: { deletedAt: null, status: true, organizationId } }),
      prisma.tbc.count({ where: { deletedAt: null, status: true, organizationId } }),
      prisma.user.count({ where: { deletedAt: null, status: true, organizationId } }),
      prisma.soapLog.count({ where: { createdAt: { gte: todayStart }, organizationId } }),
      prisma.soapLog.count({ where: { createdAt: { gte: todayStart }, error: { not: null }, organizationId } }),
      prisma.soapLog.aggregate({ _avg: { duration: true }, where: { createdAt: { gte: todayStart }, organizationId } }),
      prisma.soapLog.findMany({
        take: 10,
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.client.count({ where: { deletedAt: null, organizationId } }),
      prisma.soapLog.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: last7Days }, organizationId },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.tbc.count({ where: { deletedAt: null, status: true, organizationId } }),
      prisma.tbc.count({ where: { deletedAt: null, status: false, organizationId } }),
      prisma.filter.count({ where: { deletedAt: null, status: true, organizationId } }),
      prisma.filter.count({ where: { deletedAt: null, status: false, organizationId } }),
      prisma.sentenceCategory.findMany({
        where: { deletedAt: null, organizationId },
        select: { name: true, _count: { select: { sentences: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.demand.groupBy({
        by: ["status"],
        where: { deletedAt: null, organizationId },
        _count: { id: true },
      }),
      prisma.demand.groupBy({
        by: ["analystId"],
        where: { deletedAt: null, organizationId },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      prisma.demand.groupBy({
        by: ["clientId"],
        where: { deletedAt: null, organizationId },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      prisma.clientContract.groupBy({
        by: ["clientId"],
        where: { status: "ACTIVE", client: { organizationId } },
        _sum: { contractedHours: true },
      }),
      prisma.demand.groupBy({
        by: ["clientId"],
        where: { deletedAt: null, organizationId },
        _sum: { durationMinutes: true },
      }),
    ]);

    const dailyAggregated = dailyStats.reduce<Record<string, number>>((acc, item) => {
      const dateKey = item.createdAt.toISOString().split("T")[0];
      acc[dateKey] = (acc[dateKey] || 0) + item._count.id;
      return acc;
    }, {});

    const chartData = Object.entries(dailyAggregated).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      calls: count,
    }));

    const tbcStatusData = [
      { name: "Ativos", value: activeTbcs },
      { name: "Inativos", value: inactiveTbcs },
    ];

    const filterStatusData = [
      { name: "Ativos", value: activeFilters },
      { name: "Inativos", value: inactiveFilters },
    ];

    const sentencesByCategory = sentencesByCategoryRaw
      .map((c) => ({ name: c.name, value: c._count.sentences }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const demandsByStatus = demandsByStatusRaw.map((d) => ({
      name: DEMAND_STATUS_LABELS[d.status] || d.status,
      value: d._count.id,
    }));

    const analystIds = demandsByAnalystRaw.map((d) => d.analystId);
    const analysts = analystIds.length
      ? await prisma.analyst.findMany({ where: { id: { in: analystIds } }, select: { id: true, name: true } })
      : [];
    const analystNameById = new Map(analysts.map((a) => [a.id, a.name]));
    const demandsByAnalyst = demandsByAnalystRaw.map((d) => ({
      name: analystNameById.get(d.analystId) || "Desconhecido",
      value: d._count.id,
    }));

    const clientIdsForDemands = demandsByClientRaw.map((d) => d.clientId);
    const clientsForDemands = clientIdsForDemands.length
      ? await prisma.client.findMany({ where: { id: { in: clientIdsForDemands } }, select: { id: true, name: true } })
      : [];
    const clientNameById = new Map(clientsForDemands.map((c) => [c.id, c.name]));
    const demandsByClient = demandsByClientRaw.map((d) => ({
      name: clientNameById.get(d.clientId) || "Desconhecido",
      value: d._count.id,
    }));

    const contractedHoursByClientId = new Map(contractsByClient.map((c) => [c.clientId, c._sum.contractedHours || 0]));
    const spentMinutesByClientId = new Map(demandMinutesByClient.map((d) => [d.clientId, d._sum.durationMinutes || 0]));
    const rankingClientIds = Array.from(new Set([...contractedHoursByClientId.keys(), ...spentMinutesByClientId.keys()]));
    const rankingClients = rankingClientIds.length
      ? await prisma.client.findMany({ where: { id: { in: rankingClientIds } }, select: { id: true, name: true } })
      : [];
    const rankingClientNameById = new Map(rankingClients.map((c) => [c.id, c.name]));
    const clientHoursRanking = rankingClientIds
      .map((clientId) => ({
        name: rankingClientNameById.get(clientId) || "Desconhecido",
        contratadas: Math.round((contractedHoursByClientId.get(clientId) || 0) * 100) / 100,
        gastas: Math.round(((spentMinutesByClientId.get(clientId) || 0) / 60) * 100) / 100,
      }))
      .filter((c) => c.contratadas > 0 || c.gastas > 0)
      .sort((a, b) => b.gastas - a.gastas)
      .slice(0, 8);

    return {
      stats: {
        totalClients,
        totalTbcs,
        totalUsers,
        todaySoapCalls,
        failedToday,
        avgDuration: avgDurationResult._avg.duration || 0,
        clientCount,
      },
      recentLogs,
      chartData,
      tbcStatusData,
      filterStatusData,
      sentencesByCategory,
      demandsByStatus,
      demandsByAnalyst,
      demandsByClient,
      clientHoursRanking,
    };
  },
};
