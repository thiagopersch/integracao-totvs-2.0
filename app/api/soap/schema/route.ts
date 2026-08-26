import { NextRequest, NextResponse } from "next/server";
import { soapService, type WsName } from "@/services/soap.service";
import { tbcService } from "@/services/tbc.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { logger } from "@/lib/logger";
import { getCurrentOrganizationId } from "@/lib/tenant";
import type { SoapContext } from "@/types/soap";

export async function POST(request: NextRequest) {
  try {
    const organizationId = await getCurrentOrganizationId();
    const body = await request.json();
    const { tbcId, endpointTypeId, context } = body as { tbcId?: string; endpointTypeId?: string; context?: SoapContext };

    if (!tbcId || !endpointTypeId) {
      return NextResponse.json(
        { error: "tbcId e endpointTypeId são obrigatórios" },
        { status: 400 }
      );
    }

    // Resolve o ws folder a partir do tipo cadastrado em /admin/soap-endpoints, não de um wsName livre.
    const endpointType = await soapEndpointService.getActiveTypeById(endpointTypeId);
    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId);
    const result = await soapService.getSchema(tbc, endpointType.suffix as WsName, organizationId, context);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("SOAP getSchema error", { error: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
