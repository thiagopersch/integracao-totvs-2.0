import { NextRequest, NextResponse } from "next/server";
import { tbcService } from "@/services/tbc.service";
import { lookupSentenceContent } from "@/services/rm-sentence.service";
import { extractSentenceParameters } from "@/utils/sql-sentence-params";
import { logger } from "@/lib/logger";
import { getRequestContext } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, allowedClientIds } = await getRequestContext();
    const body = await request.json();
    const { tbcId, codColigada, codSistema, codSentenca, context } = body;

    if (!tbcId) {
      return NextResponse.json({ error: "Selecione um TBC" }, { status: 400 });
    }
    if (codColigada === undefined || codColigada === null || codColigada === "") {
      return NextResponse.json({ error: "codColigada é obrigatório" }, { status: 400 });
    }
    if (!codSistema) {
      return NextResponse.json({ error: "codSistema é obrigatório" }, { status: 400 });
    }
    if (!codSentenca) {
      return NextResponse.json({ error: "codSentenca é obrigatório" }, { status: 400 });
    }

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId, allowedClientIds);
    const contentSentence = await lookupSentenceContent(
      { codColigada: Number(codColigada), codSistema, codSentenca },
      tbc,
      organizationId,
      context
    );

    if (contentSentence === null) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      contentSentence,
      parameters: extractSentenceParameters(contentSentence),
    });
  } catch (error) {
    logger.error("SOAP sentence lookup error", { error: (error as Error).message });
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
