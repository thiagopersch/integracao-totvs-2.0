import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganizationId } from "@/lib/tenant";

export async function GET() {
  const organizationId = await getCurrentOrganizationId();
  const tbcs = await prisma.tbc.findMany({
    where: { deletedAt: null, status: true, organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      link: true,
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(tbcs);
}
