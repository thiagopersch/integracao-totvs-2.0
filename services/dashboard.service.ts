import { prisma } from "@/lib/prisma";

export const dashboardService = {
  async getStats() {
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
    ] = await Promise.all([
      prisma.client.count({ where: { deletedAt: null, status: true } }),
      prisma.tbc.count({ where: { deletedAt: null, status: true } }),
      prisma.user.count({ where: { deletedAt: null, status: true } }),
      prisma.soapLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.soapLog.count({ where: { createdAt: { gte: todayStart }, error: { not: null } } }),
      prisma.soapLog.aggregate({ _avg: { duration: true }, where: { createdAt: { gte: todayStart } } }),
      prisma.soapLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      }),
      prisma.client.count({ where: { deletedAt: null } }),
      prisma.soapLog.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: last7Days } },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
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
    };
  },
};
