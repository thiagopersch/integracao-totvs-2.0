import { NextRequest, NextResponse } from "next/server";
import { soapService } from "@/services/soap.service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpointTypeId, methodId, tbcId, method, endpointType, suffix, xml, context, timeout } = body;

    if (!method || !xml) {
      return NextResponse.json(
        { error: "method e xml são obrigatórios" },
        { status: 400 }
      );
    }

    let dataserver = "";
    let process = "";

    if (tbcId) {
      const tbc = await prisma.tbc.findUnique({ where: { id: tbcId } });
      if (tbc) {
        dataserver = tbc.link;
        process = tbc.link;
      }
    }

    const result = await soapService.execute({
      dataserver: dataserver || body.dataserver || "",
      process: process || body.process || "",
      method,
      xml,
      context,
      timeout,
      endpointType,
      suffix,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("SOAP execute error", { error: (error as Error).message });
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
