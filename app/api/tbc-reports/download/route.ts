import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { tbcService } from "@/services/tbc.service";
import { tbcReportService } from "@/services/tbc-report.service";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId, allowedClientIds } = await requirePermission("tbc_reports", "execute");
    const { tbcId, guid, fileName } = await request.json();

    if (!tbcId || !guid) {
      return NextResponse.json({ error: "tbcId e guid são obrigatórios" }, { status: 400 });
    }

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId, allowedClientIds);
    const result = await tbcReportService.downloadReport(tbc, organizationId, guid, userId);

    return NextResponse.json({ ...result, fileName: fileName || "relatorio.pdf" });
  } catch (error) {
    logger.error("TBC report download error", { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
