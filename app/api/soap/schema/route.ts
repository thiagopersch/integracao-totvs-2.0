import { NextRequest, NextResponse } from "next/server";
import { soapService } from "@/services/soap.service";
import { logger } from "@/lib/logger";
import { getCurrentOrganizationId } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const organizationId = await getCurrentOrganizationId();
    const body = await request.json();
    const { dataserver, process, context } = body;

    if (!dataserver || !process) {
      return NextResponse.json(
        { error: "dataserver e process são obrigatórios" },
        { status: 400 }
      );
    }

    const result = await soapService.getSchema(dataserver, process, organizationId, context);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("SOAP getSchema error", { error: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
