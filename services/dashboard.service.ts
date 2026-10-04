import { prisma } from "@/lib/prisma";
import { contractUsageService } from "@/services/contract-usage.service";
import { formatMonthLabel } from "@/lib/contract-usage";
import { periodToDateRange } from "@/lib/period";

const DEMAND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const DEMAND_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f97316",
  IN_PROGRESS: "#3b82f6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
};

const DEMAND_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const DEMAND_PRIORITY_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  URGENT: "#ef4444",
};

const NO_DEMAND_TYPE_COLOR = "#6b7280";

/**
 * Clients whose contracts the user is linked to: their allowed clients (UserClient) plus, when the
 * user has an Analyst record, every client that analyst logged demands for during the month.
 */
async function linkedContractClientIds(
  organizationId: string,
  allowedClientIds: string[],
  month: { year: number; month: number },
  analystId: string | null
): Promise<string[]> {
  if (!analystId) return allowedClientIds;
  const demandClients = await prisma.demand.findMany({
    where: { deletedAt: null, organizationId, analystId, date: periodToDateRange(month) },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  return Array.from(new Set([...allowedClientIds, ...demandClients.map((d) => d.clientId)]));
}

export const dashboardService = {
  async getStats(
    organizationId: string,
    allowedClientIds: string[],
    period: { gte: Date; lt: Date } | undefined,
    attentionMonth: { year: number; month: number },
    analystId: string | null = null
  ) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // SOAP metrics stay org-wide (no client FK on SoapLog, see below), but do respect the chosen
    // period; without one they default to "today"/"last 7 days" exactly as before.
    const soapRangeLower = period?.gte ?? todayStart;
    const soapRangeUpper = period?.lt;
    const soapCreatedAt = soapRangeUpper ? { gte: soapRangeLower, lt: soapRangeUpper } : { gte: soapRangeLower };
    const dailyStatsLower = period?.gte ?? last7Days;
    const dailyStatsCreatedAt = period?.lt ? { gte: dailyStatsLower, lt: period.lt } : { gte: dailyStatsLower };
    const demandDateFilter = period ? { date: period } : {};
    const clientScope = { id: { in: allowedClientIds } };
    const clientIdScope = { clientId: { in: allowedClientIds } };
    const demandWhere = { deletedAt: null, organizationId, ...clientIdScope, ...demandDateFilter };

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
      monthlyUsage,
      demandsByTypeRaw,
      demandsByPriorityRaw,
      demandsByTagRaw,
    ] = await Promise.all([
      prisma.client.count({ where: { deletedAt: null, status: true, organizationId, ...clientScope } }),
      prisma.tbc.count({ where: { deletedAt: null, status: true, organizationId, ...clientIdScope } }),
      prisma.user.count({ where: { deletedAt: null, status: true, organizationId } }),
      // SoapLog only stores the TBC's link string, not a client FK, so call-volume/health metrics
      // stay organization-wide rather than per-client scoped.
      prisma.soapLog.count({ where: { createdAt: soapCreatedAt, organizationId } }),
      prisma.soapLog.count({ where: { createdAt: soapCreatedAt, error: { not: null }, organizationId } }),
      prisma.soapLog.aggregate({ _avg: { duration: true }, where: { createdAt: soapCreatedAt, organizationId } }),
      prisma.soapLog.findMany({
        take: 10,
        where: { organizationId, ...(period ? { createdAt: soapCreatedAt } : {}) },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.client.count({ where: { deletedAt: null, organizationId, ...clientScope } }),
      prisma.soapLog.groupBy({
        by: ["createdAt"],
        where: { createdAt: dailyStatsCreatedAt, organizationId },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.tbc.count({ where: { deletedAt: null, status: true, organizationId, ...clientIdScope } }),
      prisma.tbc.count({ where: { deletedAt: null, status: false, organizationId, ...clientIdScope } }),
      prisma.filter.count({ where: { deletedAt: null, status: true, organizationId, ...clientIdScope } }),
      prisma.filter.count({ where: { deletedAt: null, status: false, organizationId, ...clientIdScope } }),
      prisma.sentenceCategory.findMany({
        where: { deletedAt: null, organizationId },
        select: { name: true, _count: { select: { sentences: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.demand.groupBy({
        by: ["status"],
        where: demandWhere,
        _count: { id: true },
      }),
      prisma.demand.groupBy({
        by: ["analystId"],
        where: demandWhere,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      prisma.demand.groupBy({
        by: ["clientId"],
        where: demandWhere,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      // Contracted hours reflect currently-active contracts, not a time-bucketed measure —
      // intentionally NOT period-filtered (a past month shouldn't hide the contract's current total).
      prisma.clientContract.groupBy({
        by: ["clientId"],
        where: { status: "ACTIVE", client: { organizationId }, ...clientIdScope },
        _sum: { contractedHours: true },
      }),
      prisma.demand.groupBy({
        by: ["clientId"],
        where: demandWhere,
        _sum: { durationMinutes: true },
      }),
      linkedContractClientIds(organizationId, allowedClientIds, attentionMonth, analystId).then((clientIds) =>
        contractUsageService.getMonthlyUsage(organizationId, attentionMonth, clientIds)
      ),
      prisma.demand.groupBy({
        by: ["demandTypeId"],
        where: demandWhere,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 8,
      }),
      prisma.demand.groupBy({ by: ["priority"], where: demandWhere, _count: { id: true } }),
      // A demand with several tags counts once under each of them.
      prisma.demandTag.groupBy({
        by: ["tagId"],
        where: { demand: demandWhere },
        _count: { demandId: true },
        orderBy: { _count: { demandId: "desc" } },
        take: 8,
      }),
    ]);

    // Every contract in force for the clients linked to the user, highest consumption first.
    const contractsUsage = monthlyUsage
      .sort((a, b) => b.percent - a.percent)
      .map(({ clientId, clientName, clientColor, usedHours, contractedHours, percent, level }) => ({
        clientId,
        clientName,
        clientColor,
        usedHours,
        contractedHours,
        percent,
        level,
      }));

    const dailyAggregated = dailyStats.reduce<Record<string, number>>((acc, item) => {
      const dateKey = item.createdAt.toISOString().split("T")[0];
      acc[dateKey] = (acc[dateKey] || 0) + item._count.id;
      return acc;
    }, {});

    const chartData = Object.entries(dailyAggregated).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      calls: count,
    }));

    const clientStatusData = [
      { name: "Ativos", value: totalClients },
      { name: "Inativos", value: Math.max(clientCount - totalClients, 0) },
    ];

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

    const statusCount = new Map(demandsByStatusRaw.map((d) => [d.status as string, d._count.id]));
    const demandsByStatus = Object.keys(DEMAND_STATUS_LABELS)
      .filter((status) => statusCount.has(status))
      .map((status) => ({
        name: DEMAND_STATUS_LABELS[status],
        value: statusCount.get(status)!,
        color: DEMAND_STATUS_COLORS[status],
      }));

    const priorityCount = new Map(demandsByPriorityRaw.map((d) => [d.priority as string, d._count.id]));
    const demandsByPriority = Object.keys(DEMAND_PRIORITY_LABELS)
      .filter((priority) => priorityCount.has(priority))
      .map((priority) => ({
        name: DEMAND_PRIORITY_LABELS[priority],
        value: priorityCount.get(priority)!,
        color: DEMAND_PRIORITY_COLORS[priority],
      }));

    const demandTypeIds = demandsByTypeRaw.flatMap((d) => (d.demandTypeId ? [d.demandTypeId] : []));
    const demandTypes = demandTypeIds.length
      ? await prisma.demandType.findMany({ where: { id: { in: demandTypeIds } }, select: { id: true, name: true, color: true } })
      : [];
    const demandTypeById = new Map(demandTypes.map((t) => [t.id, t]));
    const demandsByType = demandsByTypeRaw.map((d) => {
      const type = d.demandTypeId ? demandTypeById.get(d.demandTypeId) : undefined;
      return {
        name: type?.name ?? (d.demandTypeId ? "Desconhecido" : "Sem tipo"),
        value: d._count.id,
        color: type?.color ?? NO_DEMAND_TYPE_COLOR,
      };
    });

    const tagIds = demandsByTagRaw.map((d) => d.tagId);
    const tags = tagIds.length
      ? await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true, color: true } })
      : [];
    const tagById = new Map(tags.map((t) => [t.id, t]));
    const demandsByTag = demandsByTagRaw.map((d) => ({
      name: tagById.get(d.tagId)?.name || "Desconhecido",
      value: d._count.demandId,
      color: tagById.get(d.tagId)?.color || NO_DEMAND_TYPE_COLOR,
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
      ? await prisma.client.findMany({
          where: { id: { in: clientIdsForDemands } },
          select: { id: true, name: true, color: true },
        })
      : [];
    const clientNameById = new Map(clientsForDemands.map((c) => [c.id, c.name]));
    const clientColorById = new Map(clientsForDemands.map((c) => [c.id, c.color]));
    const demandsByClient = demandsByClientRaw.map((d) => ({
      name: clientNameById.get(d.clientId) || "Desconhecido",
      value: d._count.id,
      color: clientColorById.get(d.clientId) || "#22c55e",
    }));

    const contractedHoursByClientId = new Map(contractsByClient.map((c) => [c.clientId, c._sum.contractedHours || 0]));
    const spentMinutesByClientId = new Map(demandMinutesByClient.map((d) => [d.clientId, d._sum.durationMinutes || 0]));
    const rankingClientIds = Array.from(new Set([...contractedHoursByClientId.keys(), ...spentMinutesByClientId.keys()]));
    const rankingClients = rankingClientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: rankingClientIds } },
          select: { id: true, name: true, color: true },
        })
      : [];
    const rankingClientNameById = new Map(rankingClients.map((c) => [c.id, c.name]));
    const rankingClientColorById = new Map(rankingClients.map((c) => [c.id, c.color]));
    const clientHoursRanking = rankingClientIds
      .map((clientId) => ({
        name: rankingClientNameById.get(clientId) || "Desconhecido",
        contratadas: Math.round((contractedHoursByClientId.get(clientId) || 0) * 100) / 100,
        gastas: Math.round(((spentMinutesByClientId.get(clientId) || 0) / 60) * 100) / 100,
        color: rankingClientColorById.get(clientId) || "#22c55e",
      }))
      .filter((c) => c.contratadas > 0 || c.gastas > 0)
      .sort((a, b) => b.contratadas - a.contratadas || b.gastas - a.gastas)
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
      clientStatusData,
      tbcStatusData,
      filterStatusData,
      sentencesByCategory,
      demandsByStatus,
      demandsByPriority,
      demandsByType,
      demandsByTag,
      demandsByAnalyst,
      demandsByClient,
      clientHoursRanking,
      contractsUsage,
      contractsUsageMonthLabel: formatMonthLabel(attentionMonth),
    };
  },
};
