import { NextRequest, NextResponse } from "next/server";
import { authorizeRoute } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { denied } = await authorizeRoute("soap", "execute");
  if (denied) return denied;

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
