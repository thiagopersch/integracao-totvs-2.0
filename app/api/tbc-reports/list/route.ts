import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { tbcService } from "@/services/tbc.service";
import { tbcReportService } from "@/services/tbc-report.service";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId } = await requirePermission("tbc_reports", "execute");
    const { tbcId, codColigada } = await request.json();

    if (!tbcId || codColigada === undefined || codColigada === null) {
      return NextResponse.json({ error: "Selecione o TBC e informe a coligada" }, { status: 400 });
    }

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId);
    const reports = await tbcReportService.listReports(tbc, organizationId, Number(codColigada), userId);

    return NextResponse.json({ reports });
  } catch (error) {
    logger.error("TBC report list error", { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
