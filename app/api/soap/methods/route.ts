import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const endpointTypeId = request.nextUrl.searchParams.get("endpointTypeId");
  if (!endpointTypeId) {
    return NextResponse.json({ error: "endpointTypeId é obrigatório" }, { status: 400 });
  }

  const methods = await prisma.soapEndpointMethod.findMany({
    where: { endpointTypeId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(methods);
}
