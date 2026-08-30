import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { tbcService } from "@/services/tbc.service";
import { tbcReportService, type ReportGenerationInput } from "@/services/tbc-report.service";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId, allowedClientIds } = await requirePermission("tbc_reports", "execute");
    const { tbcId, codColigada, codSistema, codReport, fileName, filters, parameters, timeout } = await request.json();

    if (!tbcId || codColigada === undefined || !codReport || !fileName) {
      return NextResponse.json({ error: "Dados incompletos para gerar o relatório" }, { status: 400 });
    }

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId, allowedClientIds);
    const input: ReportGenerationInput = {
      codColigada: Number(codColigada),
      codSistema: codSistema || "",
      codReport: String(codReport),
      fileName: String(fileName),
      filters: Array.isArray(filters) ? filters : [],
      parameters: Array.isArray(parameters) ? parameters : [],
    };
    const timeoutMs = Number(timeout) || 20_000;

    // Assíncrono é a estratégia padrão; qualquer erro (SOAP Fault ou HTTP) — inclusive um TOTVS
    // que não exponha GenerateReportAsynchronous — dispara um único retry síncrono automático,
    // sem exigir escolha do usuário.
    try {
      const { guid } = await tbcReportService.generateReportAsync(tbc, organizationId, input, timeoutMs, userId);
      return NextResponse.json({ mode: "async", guid });
    } catch (asyncError) {
      logger.warn("GenerateReportAsynchronous falhou, tentando GenerateReport síncrono", {
        error: (asyncError as Error).message,
      });
      const { guid } = await tbcReportService.generateReportSync(tbc, organizationId, input, timeoutMs, userId);
      return NextResponse.json({ mode: "sync", guid });
    }
  } catch (error) {
    logger.error("TBC report generate error", { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
