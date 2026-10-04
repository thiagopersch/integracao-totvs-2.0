import { NextResponse } from "next/server";
import { authorizeRoute } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { denied } = await authorizeRoute("soap", "execute");
  if (denied) return denied;

  const types = await prisma.soapEndpointType.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(types);
}
