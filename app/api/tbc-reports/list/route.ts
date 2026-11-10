import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { tbcService } from "@/services/tbc.service";
import { tbcReportService } from "@/services/tbc-report.service";
import { logger } from "@/lib/logger";
import { cachedJson } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId, allowedClientIds } = await requirePermission("tbc_reports", "execute");
    const { tbcId, codColigada, codSistema, refresh, page, pageSize, q } = await request.json();

    if (!tbcId || codColigada === undefined || codColigada === null) {
      return NextResponse.json({ error: "Selecione o TBC e informe a coligada" }, { status: 400 });
    }

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId, allowedClientIds);
    // The TBC's report catalog barely changes and GetReportList is slow: cached in Redis for 30 min
    // per TBC/coligada/sistema (the screen's "Atualizar" sends refresh: true). getCredentialsForRequest
    // above still enforces the user's access to the TBC on every call.
    const reports = await cachedJson(
      `tbc-reports:${organizationId}:${tbcId}:${Number(codColigada)}:${codSistema || "*"}`,
      30 * 60,
      () => tbcReportService.listReports(tbc, organizationId, Number(codColigada), userId, codSistema || undefined),
      { refresh: refresh === true }
    );

    // Optional server-side paging/search (`page` given) — without it the full list is returned as before.
    if (page !== undefined) {
      const size = Math.min(Math.max(Number(pageSize) || 50, 1), 500);
      const current = Math.max(Number(page) || 1, 1);
      const needle = typeof q === "string" ? q.trim().toLowerCase() : "";
      const filtered = needle ? reports.filter((r) => JSON.stringify(r).toLowerCase().includes(needle)) : reports;
      return NextResponse.json({
        reports: filtered.slice((current - 1) * size, current * size),
        meta: { page: current, pageSize: size, total: filtered.length, totalPages: Math.ceil(filtered.length / size) },
      });
    }

    return NextResponse.json({ reports });
  } catch (error) {
    logger.error("TBC report list error", { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
