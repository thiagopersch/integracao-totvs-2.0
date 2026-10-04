import { NextRequest, NextResponse } from "next/server";
import { authorizeRoute } from "@/lib/api-auth";
import { revalidateTag } from "next/cache";
import { soapService, type WsName } from "@/services/soap.service";
import { tbcService } from "@/services/tbc.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { logger } from "@/lib/logger";
import type { SoapMethod } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  const { ctx, denied } = await authorizeRoute("soap", "execute");
  if (denied) return denied;
  try {
    const { organizationId, userId, allowedClientIds } = ctx;
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

    const tbc = await tbcService.getCredentialsForRequest(tbcId, organizationId, allowedClientIds);

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

    // Stale-while-revalidate: the next dashboard visit gets the cached stats instantly and refreshes
    // them in the background (expire: 0 made every visit after any SOAP call a blocking ~20-query miss).
    revalidateTag("dashboard", "max");
    return NextResponse.json(result);
  } catch (error) {
    // soapService.execute logs the SoapLog row even on failure, so the dashboard's
    // recent-executions box needs invalidating here too, not just on the success path.
    revalidateTag("dashboard", "max");
    logger.error("SOAP execute error", { error: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
