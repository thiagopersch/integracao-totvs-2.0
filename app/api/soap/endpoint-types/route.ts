import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const types = await prisma.soapEndpointType.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(types);
}
