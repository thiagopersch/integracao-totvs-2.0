import { NextRequest, NextResponse } from "next/server";
import { soapService, type WsName } from "@/services/soap.service";
import { tbcService } from "@/services/tbc.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { logger } from "@/lib/logger";
import { getRequestContext } from "@/lib/tenant";
import type { SoapMethod } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId } = await getRequestContext();
    const body = await request.json();
    const { tbcId, endpointTypeId, methodId, xml, context, timeout } = body;

    if (!xml) {
      return NextResponse.json({ error: "xml é obrigatório" }, { status: 400 });
    }
    if (!tbcId) {
      return NextResponse.json(
        { error: "Selecione um TBC — toda requisição ao TOTVS precisa estar vinculada a um TBC cadastrado" },
        { status: 400 }
      );
    }
    if (!endpointTypeId || !methodId) {
      return NextResponse.json(
        { error: "Selecione o tipo de endpoint e o método — ambos cadastrados em /admin/soap-endpoints" },
        { status: 400 }
      );
    }

    // Never trust a client-supplied method/wsName string: always resolve them from what's
    // actually registered (and active) in /admin/soap-endpoints for the given ids.
    const endpointType = await soapEndpointService.getActiveTypeById(endpointTypeId);
    const endpointMethod = await soapEndpointService.getActiveMethodById(methodId);
    if (endpointMethod.endpointTypeId !== endpointType.id) {
      return NextResponse.json(
        { error: "O método selecionado não pertence ao tipo de endpoint selecionado" },
        { status: 400 }
      );
    }

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId);

    const result = await soapService.execute(
      {
        tbc,
        wsName: endpointType.suffix as WsName,
        method: endpointMethod.method as SoapMethod,
        xml,
        context,
        timeout,
        endpointType: endpointType.type,
      },
      organizationId,
      userId
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error("SOAP execute error", { error: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
